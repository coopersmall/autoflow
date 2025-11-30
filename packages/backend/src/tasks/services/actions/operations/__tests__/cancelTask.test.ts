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
import { cancelTask } from '@backend/tasks/services/actions/operations/cancelTask';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok } from 'neverthrow';

describe('cancelTask', () => {
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
    mockQueue.remove.mockReset();
  });

  describe('successful cancellation', () => {
    it('should successfully cancel a pending task', async () => {
      const task = createTestTaskRecord({ status: 'pending' });
      const updatedTask = { ...task, status: 'cancelled' as const };

      mockRepo.get.mockResolvedValue(ok(task));
      mockQueue.remove.mockResolvedValue(ok(undefined));
      mockRepo.update.mockResolvedValue(ok(updatedTask));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await cancelTask(ctx, request);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('cancelled');
      expect(mockRepo.get).toHaveBeenCalledWith(task.id);
      expect(mockQueue.remove).toHaveBeenCalledWith(
        request.correlationId,
        task.id,
      );
      expect(mockRepo.update).toHaveBeenCalledWith(task.id, {
        status: 'cancelled',
      });
    });

    it('should successfully cancel a delayed task', async () => {
      const task = createTestTaskRecord({
        status: 'delayed',
        delayUntil: new Date(Date.now() + 60000),
      });
      const updatedTask = { ...task, status: 'cancelled' as const };

      mockRepo.get.mockResolvedValue(ok(task));
      mockQueue.remove.mockResolvedValue(ok(undefined));
      mockRepo.update.mockResolvedValue(ok(updatedTask));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await cancelTask(ctx, request);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('cancelled');
    });

    it('should log successful cancellation', async () => {
      const task = createTestTaskRecord({ status: 'pending' });
      const updatedTask = { ...task, status: 'cancelled' as const };

      mockRepo.get.mockResolvedValue(ok(task));
      mockQueue.remove.mockResolvedValue(ok(undefined));
      mockRepo.update.mockResolvedValue(ok(updatedTask));

      const ctx = createContext();
      const request = createRequest(task.id);

      await cancelTask(ctx, request);

      expect(mockLogger.info).toHaveBeenCalledWith('Task cancelled', {
        taskId: task.id,
      });
    });
  });

  describe('invalid state errors', () => {
    it('should return error for active task', async () => {
      const task = createTestTaskRecord({ status: 'active' });

      mockRepo.get.mockResolvedValue(ok(task));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await cancelTask(ctx, request);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('Cannot cancel task in active state');
      expect(mockQueue.remove).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should return error for completed task', async () => {
      const task = createTestTaskRecord({ status: 'completed' });

      mockRepo.get.mockResolvedValue(ok(task));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await cancelTask(ctx, request);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('Cannot cancel task in completed state');
    });

    it('should return error for failed task', async () => {
      const task = createTestTaskRecord({ status: 'failed' });

      mockRepo.get.mockResolvedValue(ok(task));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await cancelTask(ctx, request);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('Cannot cancel task in failed state');
    });

    it('should return error for already cancelled task', async () => {
      const task = createTestTaskRecord({ status: 'cancelled' });

      mockRepo.get.mockResolvedValue(ok(task));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await cancelTask(ctx, request);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('Cannot cancel task in cancelled state');
    });
  });

  describe('error handling', () => {
    it('should return error when task not found', async () => {
      const notFoundError = new ErrorWithMetadata('Task not found', 'NotFound');
      mockRepo.get.mockResolvedValue(err(notFoundError));

      const ctx = createContext();
      const request = createRequest(TaskId('nonexistent-task'));

      const result = await cancelTask(ctx, request);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(notFoundError);
    });

    it('should handle queue removal failure gracefully and still update DB', async () => {
      const task = createTestTaskRecord({ status: 'pending' });
      const updatedTask = { ...task, status: 'cancelled' as const };
      const queueError = new ErrorWithMetadata('Queue error', 'InternalServer');

      mockRepo.get.mockResolvedValue(ok(task));
      mockQueue.remove.mockResolvedValue(err(queueError));
      mockRepo.update.mockResolvedValue(ok(updatedTask));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await cancelTask(ctx, request);

      // Should still succeed - queue removal failure is logged but not fatal
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().status).toBe('cancelled');

      // Should log the error
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Could not remove task from queue',
        queueError,
        { taskId: task.id },
      );

      // Should still update the database
      expect(mockRepo.update).toHaveBeenCalledWith(task.id, {
        status: 'cancelled',
      });
    });

    it('should return error when database update fails', async () => {
      const task = createTestTaskRecord({ status: 'pending' });
      const dbError = new ErrorWithMetadata('Database error', 'InternalServer');

      mockRepo.get.mockResolvedValue(ok(task));
      mockQueue.remove.mockResolvedValue(ok(undefined));
      mockRepo.update.mockResolvedValue(err(dbError));

      const ctx = createContext();
      const request = createRequest(task.id);

      const result = await cancelTask(ctx, request);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(dbError);
    });
  });

  describe('queue interaction', () => {
    it('should remove task from correct queue based on queueName', async () => {
      const task = createTestTaskRecord({
        status: 'pending',
        queueName: 'users:send-email',
      });
      const updatedTask = { ...task, status: 'cancelled' as const };

      mockRepo.get.mockResolvedValue(ok(task));
      mockQueue.remove.mockResolvedValue(ok(undefined));
      mockRepo.update.mockResolvedValue(ok(updatedTask));

      // Create a factory that tracks which queue name was requested
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

      await cancelTask(ctx, createRequest(task.id));

      expect(requestedQueueName).toBe('users:send-email');
    });
  });
});
