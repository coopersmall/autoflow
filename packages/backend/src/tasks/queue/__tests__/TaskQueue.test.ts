import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import {
  createTestQueueJob,
  getMockedQueueClient,
} from '@backend/infrastructure/queue/__mocks__/QueueClient.mock';
import { getMockedQueueClientFactory } from '@backend/infrastructure/queue/__mocks__/QueueClientFactory.mock';
import type { QueueConfig } from '@backend/infrastructure/queue/domain/QueueConfig';
import { TaskId } from '@backend/tasks/domain/TaskId';
import { createTaskQueue } from '@backend/tasks/queue/TaskQueue';
import {
  createTestTaskRecord,
  getMockedTasksRepo,
} from '@backend/tasks/repos/__mocks__/TasksRepo.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok } from 'neverthrow';

describe('TaskQueue', () => {
  const mockLogger = getMockedLogger();
  const mockAppConfig = getMockedAppConfigurationService();
  const mockQueueClient = getMockedQueueClient();
  const mockTasksRepo = getMockedTasksRepo();
  const mockQueueClientFactory = getMockedQueueClientFactory();

  const createQueue = (queueName = 'test-queue', queueConfig?: QueueConfig) => {
    return createTaskQueue(
      {
        queueName,
        logger: mockLogger,
        appConfig: mockAppConfig,
        queueConfig,
      },
      {
        createQueueClientFactory: () => mockQueueClientFactory,
        createTasksRepo: () => mockTasksRepo,
      },
    );
  };

  beforeEach(() => {
    mock.restore();
    mockQueueClient.enqueue.mockReset();
    mockQueueClient.remove.mockReset();
    mockQueueClient.getJob.mockReset();
    mockQueueClient.getStats.mockReset();
    mockQueueClient.close.mockReset();
    mockTasksRepo.update.mockReset();
    mockQueueClientFactory.getQueueClient.mockReset();
    // Default: factory returns the mock client
    mockQueueClientFactory.getQueueClient.mockReturnValue(ok(mockQueueClient));
  });

  describe('enqueue', () => {
    it('should successfully enqueue a task', async () => {
      const task = createTestTaskRecord();
      const queueJob = createTestQueueJob({ id: 'job-123' });

      mockQueueClient.enqueue.mockResolvedValue(ok(queueJob));
      mockTasksRepo.update.mockResolvedValue(ok(task));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      const result = await queue.enqueue(correlationId, task);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(queueJob);
    });

    it('should call queue client with correct parameters', async () => {
      const task = createTestTaskRecord();
      const queueJob = createTestQueueJob({ id: 'job-123' });

      mockQueueClient.enqueue.mockResolvedValue(ok(queueJob));
      mockTasksRepo.update.mockResolvedValue(ok(task));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      await queue.enqueue(correlationId, task);

      // Expect QueueJobInput format (converted from TaskRecord)
      expect(mockQueueClient.enqueue).toHaveBeenCalledWith(correlationId, {
        id: task.id,
        name: task.taskName,
        data: task.payload,
        priority: task.priority,
        delay: undefined,
        maxAttempts: task.maxAttempts,
      });
    });

    it('should update task record with external job ID', async () => {
      const task = createTestTaskRecord({ id: TaskId('task-456') });
      const queueJob = createTestQueueJob({ id: 'job-789' });

      mockQueueClient.enqueue.mockResolvedValue(ok(queueJob));
      mockTasksRepo.update.mockResolvedValue(ok(task));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      await queue.enqueue(correlationId, task);

      expect(mockTasksRepo.update).toHaveBeenCalledWith(task.id, {
        externalId: 'job-789',
      });
    });

    it('should log successful enqueue', async () => {
      const task = createTestTaskRecord({
        id: TaskId('task-123'),
        taskName: 'test:send-email',
        queueName: 'test-queue',
      });
      const queueJob = createTestQueueJob({ id: 'job-456' });

      mockQueueClient.enqueue.mockResolvedValue(ok(queueJob));
      mockTasksRepo.update.mockResolvedValue(ok(task));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      await queue.enqueue(correlationId, task);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Task enqueued successfully',
        expect.objectContaining({
          correlationId: 'corr-123',
          taskId: 'task-123',
          externalId: 'job-456',
          queueName: 'test-queue',
          taskName: 'test:send-email',
        }),
      );
    });

    it('should return error when queue client fails', async () => {
      const task = createTestTaskRecord();
      const queueError = new ErrorWithMetadata(
        'Queue connection failed',
        'InternalServer',
      );

      mockQueueClient.enqueue.mockResolvedValue(err(queueError));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      const result = await queue.enqueue(correlationId, task);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(queueError);
    });

    it('should log error when queue client fails', async () => {
      const task = createTestTaskRecord();
      const queueError = new ErrorWithMetadata(
        'Queue connection failed',
        'InternalServer',
      );

      mockQueueClient.enqueue.mockResolvedValue(err(queueError));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      await queue.enqueue(correlationId, task);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to enqueue task',
        queueError,
        expect.objectContaining({
          correlationId: 'corr-123',
          taskId: task.id,
          queueName: task.queueName,
        }),
      );
    });

    it('should succeed even if database update fails (non-fatal)', async () => {
      const task = createTestTaskRecord();
      const queueJob = createTestQueueJob({ id: 'job-123' });
      const dbError = new ErrorWithMetadata('Database error', 'InternalServer');

      mockQueueClient.enqueue.mockResolvedValue(ok(queueJob));
      mockTasksRepo.update.mockResolvedValue(err(dbError));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      const result = await queue.enqueue(correlationId, task);

      // Should still succeed - job is in queue
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(queueJob);
    });

    it('should log warning when database update fails', async () => {
      const task = createTestTaskRecord();
      const queueJob = createTestQueueJob({ id: 'job-123' });
      const dbError = new ErrorWithMetadata('Database error', 'InternalServer');

      mockQueueClient.enqueue.mockResolvedValue(ok(queueJob));
      mockTasksRepo.update.mockResolvedValue(err(dbError));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      await queue.enqueue(correlationId, task);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update task with external ID',
        dbError,
        expect.objectContaining({
          correlationId: 'corr-123',
          taskId: task.id,
          externalId: 'job-123',
        }),
      );
    });

    it('should return error when queue client factory fails', async () => {
      const task = createTestTaskRecord();
      const factoryError = new ErrorWithMetadata(
        'Redis not configured',
        'InternalServer',
      );

      mockQueueClientFactory.getQueueClient.mockReturnValue(err(factoryError));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      const result = await queue.enqueue(correlationId, task);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(factoryError);
    });
  });

  describe('remove', () => {
    it('should successfully remove a task from queue', async () => {
      mockQueueClient.remove.mockResolvedValue(ok(undefined));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');
      const taskId = TaskId('task-456');

      const result = await queue.remove(correlationId, taskId);

      expect(result.isOk()).toBe(true);
    });

    it('should call queue client with correct parameters', async () => {
      mockQueueClient.remove.mockResolvedValue(ok(undefined));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');
      const taskId = TaskId('task-456');

      await queue.remove(correlationId, taskId);

      expect(mockQueueClient.remove).toHaveBeenCalledWith(
        correlationId,
        taskId,
      );
    });

    it('should log successful removal', async () => {
      mockQueueClient.remove.mockResolvedValue(ok(undefined));

      const queue = createQueue('my-queue');
      const correlationId = CorrelationId('corr-123');
      const taskId = TaskId('task-456');

      await queue.remove(correlationId, taskId);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Task removed from queue',
        expect.objectContaining({
          correlationId: 'corr-123',
          taskId: 'task-456',
          queueName: 'my-queue',
        }),
      );
    });

    it('should return error when queue client fails', async () => {
      const removeError = new ErrorWithMetadata(
        'Failed to remove job',
        'InternalServer',
      );
      mockQueueClient.remove.mockResolvedValue(err(removeError));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');
      const taskId = TaskId('task-456');

      const result = await queue.remove(correlationId, taskId);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(removeError);
    });

    it('should log error when removal fails', async () => {
      const removeError = new ErrorWithMetadata(
        'Failed to remove job',
        'InternalServer',
      );
      mockQueueClient.remove.mockResolvedValue(err(removeError));

      const queue = createQueue('my-queue');
      const correlationId = CorrelationId('corr-123');
      const taskId = TaskId('task-456');

      await queue.remove(correlationId, taskId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove task from queue',
        removeError,
        expect.objectContaining({
          correlationId: 'corr-123',
          taskId: 'task-456',
          queueName: 'my-queue',
        }),
      );
    });
  });

  describe('getJob', () => {
    it('should return job when found', async () => {
      const queueJob = createTestQueueJob({ id: 'job-123', name: 'test:task' });
      mockQueueClient.getJob.mockResolvedValue(ok(queueJob));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      const result = await queue.getJob(correlationId, 'job-123');

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(queueJob);
    });

    it('should return null when job not found', async () => {
      mockQueueClient.getJob.mockResolvedValue(ok(null));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      const result = await queue.getJob(correlationId, 'nonexistent-job');

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });

    it('should call queue client with correct parameters', async () => {
      mockQueueClient.getJob.mockResolvedValue(ok(null));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      await queue.getJob(correlationId, 'job-456');

      expect(mockQueueClient.getJob).toHaveBeenCalledWith(
        correlationId,
        'job-456',
      );
    });

    it('should return error when queue client fails', async () => {
      const getJobError = new ErrorWithMetadata(
        'Failed to get job',
        'InternalServer',
      );
      mockQueueClient.getJob.mockResolvedValue(err(getJobError));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      const result = await queue.getJob(correlationId, 'job-123');

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(getJobError);
    });

    it('should log error when getJob fails', async () => {
      const getJobError = new ErrorWithMetadata(
        'Failed to get job',
        'InternalServer',
      );
      mockQueueClient.getJob.mockResolvedValue(err(getJobError));

      const queue = createQueue('my-queue');
      const correlationId = CorrelationId('corr-123');

      await queue.getJob(correlationId, 'job-456');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get job',
        getJobError,
        expect.objectContaining({
          correlationId: 'corr-123',
          jobId: 'job-456',
          queueName: 'my-queue',
        }),
      );
    });
  });

  describe('getJobCounts', () => {
    it('should return queue statistics', async () => {
      const stats = {
        queueName: 'test-queue',
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      };
      mockQueueClient.getStats.mockResolvedValue(ok(stats));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      const result = await queue.getJobCounts(correlationId);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(stats);
    });

    it('should call queue client getStats', async () => {
      const stats = {
        queueName: 'test-queue',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
      mockQueueClient.getStats.mockResolvedValue(ok(stats));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      await queue.getJobCounts(correlationId);

      expect(mockQueueClient.getStats).toHaveBeenCalledWith(correlationId);
    });

    it('should return error when queue client fails', async () => {
      const statsError = new ErrorWithMetadata(
        'Failed to get stats',
        'InternalServer',
      );
      mockQueueClient.getStats.mockResolvedValue(err(statsError));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      const result = await queue.getJobCounts(correlationId);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(statsError);
    });

    it('should log error when getJobCounts fails', async () => {
      const statsError = new ErrorWithMetadata(
        'Failed to get stats',
        'InternalServer',
      );
      mockQueueClient.getStats.mockResolvedValue(err(statsError));

      const queue = createQueue('my-queue');
      const correlationId = CorrelationId('corr-123');

      await queue.getJobCounts(correlationId);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get job counts',
        statsError,
        expect.objectContaining({
          correlationId: 'corr-123',
          queueName: 'my-queue',
        }),
      );
    });
  });

  describe('close', () => {
    it('should close the queue client', async () => {
      mockQueueClient.close.mockResolvedValue(undefined);

      const queue = createQueue();
      // First call to initialize the client
      const correlationId = CorrelationId('corr-123');
      mockQueueClient.getStats.mockResolvedValue(
        ok({
          queueName: 'test-queue',
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        }),
      );
      await queue.getJobCounts(correlationId);

      await queue.close();

      expect(mockQueueClient.close).toHaveBeenCalled();
    });

    it('should log when queue is closed', async () => {
      mockQueueClient.close.mockResolvedValue(undefined);

      const queue = createQueue('my-queue');
      // Initialize the client first
      const correlationId = CorrelationId('corr-123');
      mockQueueClient.getStats.mockResolvedValue(
        ok({
          queueName: 'my-queue',
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
        }),
      );
      await queue.getJobCounts(correlationId);

      await queue.close();

      expect(mockLogger.info).toHaveBeenCalledWith('TaskQueue closed', {
        queueName: 'my-queue',
      });
    });

    it('should handle close when client factory fails', async () => {
      const factoryError = new ErrorWithMetadata(
        'Redis not configured',
        'InternalServer',
      );
      mockQueueClientFactory.getQueueClient.mockReturnValue(err(factoryError));

      const queue = createQueue('my-queue');

      // Should not throw
      await queue.close();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get queue client for closing',
        factoryError,
        expect.objectContaining({ queueName: 'my-queue' }),
      );
    });
  });

  describe('client caching', () => {
    it('should reuse queue client instance', async () => {
      const stats = {
        queueName: 'test-queue',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
      mockQueueClient.getStats.mockResolvedValue(ok(stats));

      const queue = createQueue();
      const correlationId = CorrelationId('corr-123');

      // Multiple calls should reuse client
      await queue.getJobCounts(correlationId);
      await queue.getJobCounts(correlationId);
      await queue.getJobCounts(correlationId);

      // Factory should only be called once
      expect(mockQueueClientFactory.getQueueClient).toHaveBeenCalledTimes(1);
    });
  });
});
