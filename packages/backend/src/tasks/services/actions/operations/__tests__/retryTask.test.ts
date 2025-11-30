import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { TaskId } from '@backend/tasks/domain/TaskId';
import {
  getMockedTaskQueue,
  getMockedTaskQueueFactory,
} from '@backend/tasks/queue/__mocks__/TaskQueue.mock';
import {
  createTestTaskRecord,
  getMockedTasksRepo,
} from '@backend/tasks/repos/__mocks__/TasksRepo.mock';
import { retryTask } from '@backend/tasks/services/actions/operations/retryTask';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok } from 'neverthrow';

describe('retryTask', () => {
  const mockRepo = getMockedTasksRepo();
  const mockQueue = getMockedTaskQueue();
  const mockLogger = getMockedLogger();
  const mockTaskQueueFactory = getMockedTaskQueueFactory(mockQueue);

  const createContext = () => ({
    tasksRepo: mockRepo,
    taskQueue: mockTaskQueueFactory,
    logger: mockLogger,
  });

  const createRequest = (taskId: TaskId = TaskId('task-123')) => ({
    correlationId: CorrelationId('corr-123'),
    taskId,
  });

  beforeEach(() => {
    mock.restore();
    mockRepo.get.mockReset();
    mockRepo.update.mockReset();
    mockQueue.enqueue.mockReset();
  });

  describe('successful retry', () => {
    it('should successfully retry a failed task', async () => {
      const task = createTestTaskRecord({
        status: 'failed',
        attempts: 3,
        failedAt: new Date(),
        error: {
          success: false,
          reason: 'Previous error',
          lastAttemptAt: new Date(),
        },
      });
      const updatedTask = {
        ...task,
        status: 'pending' as const,
        attempts: 0,
        failedAt: undefined,
        error: undefined,
      };
      const queueJob = { id: 'job-456', name: task.taskName, data: {} };

      mockRepo.get.mockResolvedValue(ok(task));
      mockRepo.update.mockResolvedValue(ok(updatedTask));
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await retryTask(ctx, request);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('pending');
      expect(result._unsafeUnwrap().attempts).toBe(0);
    });

    it('should reset attempts to 0', async () => {
      const task = createTestTaskRecord({
        status: 'failed',
        attempts: 5,
      });
      const updatedTask = { ...task, status: 'pending' as const, attempts: 0 };
      const queueJob = { id: 'job-456', name: task.taskName, data: {} };

      mockRepo.get.mockResolvedValue(ok(task));
      mockRepo.update.mockResolvedValue(ok(updatedTask));
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const ctx = createContext();
      await retryTask(ctx, createRequest(task.id));

      expect(mockRepo.update).toHaveBeenCalledWith(task.id, {
        status: 'pending',
        attempts: 0,
        failedAt: null,
        error: null,
      });
    });

    it('should clear error and failedAt fields', async () => {
      const task = createTestTaskRecord({
        status: 'failed',
        failedAt: new Date('2024-01-01'),
        error: {
          success: false,
          reason: 'Some error',
          stackTrace: 'stack...',
          lastAttemptAt: new Date(),
        },
      });
      const updatedTask = {
        ...task,
        status: 'pending' as const,
        attempts: 0,
        failedAt: undefined,
        error: undefined,
      };
      const queueJob = { id: 'job-456', name: task.taskName, data: {} };

      mockRepo.get.mockResolvedValue(ok(task));
      mockRepo.update.mockResolvedValue(ok(updatedTask));
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const ctx = createContext();
      await retryTask(ctx, createRequest(task.id));

      expect(mockRepo.update).toHaveBeenCalledWith(
        task.id,
        expect.objectContaining({
          failedAt: null,
          error: null,
        }),
      );
    });

    it('should log retry with jobId', async () => {
      const task = createTestTaskRecord({ status: 'failed' });
      const updatedTask = { ...task, status: 'pending' as const, attempts: 0 };
      const queueJob = { id: 'job-789', name: task.taskName, data: {} };

      mockRepo.get.mockResolvedValue(ok(task));
      mockRepo.update.mockResolvedValue(ok(updatedTask));
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const ctx = createContext();
      await retryTask(ctx, createRequest(task.id));

      expect(mockLogger.info).toHaveBeenCalledWith('Task re-queued', {
        taskId: task.id,
        jobId: 'job-789',
      });
    });

    it('should enqueue the updated task to the queue', async () => {
      const task = createTestTaskRecord({ status: 'failed' });
      const updatedTask = { ...task, status: 'pending' as const, attempts: 0 };
      const queueJob = { id: 'job-456', name: task.taskName, data: {} };

      mockRepo.get.mockResolvedValue(ok(task));
      mockRepo.update.mockResolvedValue(ok(updatedTask));
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const ctx = createContext();
      const request = createRequest(task.id);

      await retryTask(ctx, request);

      expect(mockQueue.enqueue).toHaveBeenCalledWith(
        request.correlationId,
        updatedTask,
      );
    });
  });

  describe('invalid state errors', () => {
    it('should return error for pending task', async () => {
      const task = createTestTaskRecord({ status: 'pending' });

      mockRepo.get.mockResolvedValue(ok(task));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await retryTask(ctx, request);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('Cannot retry task in pending state');
      expect(mockRepo.update).not.toHaveBeenCalled();
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should return error for active task', async () => {
      const task = createTestTaskRecord({ status: 'active' });

      mockRepo.get.mockResolvedValue(ok(task));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await retryTask(ctx, request);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('Cannot retry task in active state');
    });

    it('should return error for completed task', async () => {
      const task = createTestTaskRecord({ status: 'completed' });

      mockRepo.get.mockResolvedValue(ok(task));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await retryTask(ctx, request);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('Cannot retry task in completed state');
    });

    it('should return error for delayed task', async () => {
      const task = createTestTaskRecord({ status: 'delayed' });

      mockRepo.get.mockResolvedValue(ok(task));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await retryTask(ctx, request);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('Cannot retry task in delayed state');
    });

    it('should return error for cancelled task', async () => {
      const task = createTestTaskRecord({ status: 'cancelled' });

      mockRepo.get.mockResolvedValue(ok(task));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await retryTask(ctx, request);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('Cannot retry task in cancelled state');
    });
  });

  describe('error handling', () => {
    it('should return error when task not found', async () => {
      const notFoundError = new ErrorWithMetadata('Task not found', 'NotFound');
      mockRepo.get.mockResolvedValue(err(notFoundError));

      const ctx = createContext();
      const request = createRequest(TaskId('nonexistent-task'));

      const result = await retryTask(ctx, request);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(notFoundError);
    });

    it('should return error when database update fails', async () => {
      const task = createTestTaskRecord({ status: 'failed' });
      const dbError = new ErrorWithMetadata('Database error', 'InternalServer');

      mockRepo.get.mockResolvedValue(ok(task));
      mockRepo.update.mockResolvedValue(err(dbError));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await retryTask(ctx, request);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(dbError);
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should return error when enqueue fails', async () => {
      const task = createTestTaskRecord({ status: 'failed' });
      const updatedTask = { ...task, status: 'pending' as const, attempts: 0 };
      const queueError = new ErrorWithMetadata('Queue error', 'InternalServer');

      mockRepo.get.mockResolvedValue(ok(task));
      mockRepo.update.mockResolvedValue(ok(updatedTask));
      mockQueue.enqueue.mockResolvedValue(err(queueError));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await retryTask(ctx, request);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(queueError);
    });
  });

  describe('queue interaction', () => {
    it('should use correct queue based on task queueName', async () => {
      const task = createTestTaskRecord({
        status: 'failed',
        queueName: 'orders:process-payment',
      });
      const updatedTask = { ...task, status: 'pending' as const, attempts: 0 };
      const queueJob = { id: 'job-456', name: task.taskName, data: {} };

      mockRepo.get.mockResolvedValue(ok(task));
      mockRepo.update.mockResolvedValue(ok(updatedTask));
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      // Track which queue name was requested
      let requestedQueueName = '';
      const trackingFactory = (queueName: string) => {
        requestedQueueName = queueName;
        return mockQueue;
      };

      const ctx = {
        tasksRepo: mockRepo,
        taskQueue: trackingFactory,
        logger: mockLogger,
      };

      await retryTask(ctx, createRequest(task.id));

      expect(requestedQueueName).toBe('orders:process-payment');
    });
  });

  describe('operation order', () => {
    it('should update database before enqueueing', async () => {
      const task = createTestTaskRecord({ status: 'failed' });
      const updatedTask = { ...task, status: 'pending' as const, attempts: 0 };
      const queueJob = { id: 'job-456', name: task.taskName, data: {} };

      const callOrder: string[] = [];

      mockRepo.get.mockResolvedValue(ok(task));
      mockRepo.update.mockImplementation(async () => {
        callOrder.push('update');
        return ok(updatedTask);
      });
      mockQueue.enqueue.mockImplementation(async () => {
        callOrder.push('enqueue');
        return ok(queueJob);
      });

      const ctx = createContext();
      await retryTask(ctx, createRequest(task.id));

      expect(callOrder).toEqual(['update', 'enqueue']);
    });
  });
});
