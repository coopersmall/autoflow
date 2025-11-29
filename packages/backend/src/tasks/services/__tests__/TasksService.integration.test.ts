/**
 * TasksService integration tests.
 *
 * Tests the TasksService methods against real PostgreSQL and Redis instances.
 * These tests verify that:
 * - Query methods correctly filter and retrieve tasks
 * - Operation methods (cancel, retry) work end-to-end
 * - Queue statistics are retrieved correctly
 *
 * These tests require real Redis and PostgreSQL connections.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import type { TaskContext } from '@backend/tasks/domain/TaskContext';
import { defineTask } from '@backend/tasks/domain/TaskDefinition';
import type { TaskError } from '@backend/tasks/domain/TaskError';
import { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskResult } from '@backend/tasks/domain/TaskResult';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import { createTaskScheduler } from '@backend/tasks/scheduler/TaskScheduler';
import { createTasksService } from '@backend/tasks/services/TasksService';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { CorrelationId } from '@core/domain/CorrelationId';
import { UserId } from '@core/domain/user/user';
import { validate } from '@core/validation/validate';
import { ok, type Result } from 'neverthrow';
import zod from 'zod';

describe('TasksService Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  // Test payload schema
  const testPayloadSchema = zod.object({
    message: zod.string(),
    value: zod.number().optional(),
  });

  type TestPayload = zod.infer<typeof testPayloadSchema>;

  const testValidator = (data: unknown) => validate(testPayloadSchema, data);

  // Simple handler that always succeeds
  const successHandler = async (
    _payload: TestPayload,
    _ctx: TaskContext,
  ): Promise<Result<TaskResult, TaskError>> => {
    return ok({
      success: true as const,
      duration: 10,
      output: { processed: true },
    });
  };

  // Helper to create a task definition
  const createTestTask = (queueName: string) =>
    defineTask<TestPayload>({
      queueName,
      validator: testValidator,
      handler: successHandler,
      options: {
        maxAttempts: 3,
        priority: 'normal',
      },
    });

  // Helper to schedule a task and return the created record
  const scheduleTask = async (
    queueName: string,
    payload: TestPayload,
    options?: { userId?: string; delayMs?: number },
  ) => {
    const config = getConfig();
    const logger = getLogger();
    const scheduler = createTaskScheduler({ logger, appConfig: config });
    const task = createTestTask(queueName);

    const result = await scheduler.schedule(CorrelationId(), task, payload, {
      userId: options?.userId ? UserId(options.userId) : undefined,
      delayMs: options?.delayMs,
    });

    return result._unsafeUnwrap();
  };

  // Test queue name prefix for isolation
  let testQueuePrefix: string;

  beforeEach(() => {
    testQueuePrefix = `test-svc-${Date.now()}`;
  });

  describe('Query Methods', () => {
    describe('getByStatus', () => {
      it('returns tasks matching the specified status', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        // Schedule a pending task
        const queueName = `${testQueuePrefix}-pending`;
        await scheduleTask(queueName, { message: 'pending task' });

        // Query by pending status
        const result = await service.getByStatus('pending');

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks.length).toBeGreaterThanOrEqual(1);
        expect(tasks.every((t) => t.status === 'pending')).toBe(true);
      });

      it('returns empty array when no tasks match status', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        // Query for a status that has no tasks (assuming fresh database)
        const result = await service.getByStatus('cancelled');

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks).toEqual([]);
      });
    });

    describe('getByTaskName', () => {
      it('returns tasks matching the specified task name', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        // Schedule tasks with specific queue names
        const queueName = `${testQueuePrefix}-by-name`;
        await scheduleTask(queueName, { message: 'task 1' });
        await scheduleTask(queueName, { message: 'task 2' });
        await scheduleTask(`${testQueuePrefix}-other`, { message: 'other' });

        // Query by task name (queueName becomes taskName)
        const result = await service.getByTaskName(queueName);

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks.length).toBe(2);
        expect(tasks.every((t) => t.taskName === queueName)).toBe(true);
      });

      it('returns empty array when no tasks match name', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const result = await service.getByTaskName('non-existent-task-name');

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks).toEqual([]);
      });
    });

    describe('getByUserId', () => {
      it('returns tasks for the specified user', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const userId = `user-${Date.now()}`;
        const queueName = `${testQueuePrefix}-by-user`;

        // Schedule tasks for specific user
        await scheduleTask(queueName, { message: 'user task 1' }, { userId });
        await scheduleTask(queueName, { message: 'user task 2' }, { userId });
        await scheduleTask(
          queueName,
          { message: 'other user' },
          { userId: 'other-user' },
        );

        // Query by user ID
        const result = await service.getByUserId(UserId(userId));

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks.length).toBe(2);
        expect(tasks.every((t) => t.userId === userId)).toBe(true);
      });

      it('returns empty array when user has no tasks', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const result = await service.getByUserId(UserId('non-existent-user'));

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks).toEqual([]);
      });
    });

    describe('listTasks', () => {
      it('returns all tasks when no filters provided', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-list-all`;
        await scheduleTask(queueName, { message: 'task 1' });
        await scheduleTask(queueName, { message: 'task 2' });
        await scheduleTask(queueName, { message: 'task 3' });

        const result = await service.listTasks();

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks.length).toBeGreaterThanOrEqual(3);
      });

      it('filters by status', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-list-status`;
        await scheduleTask(queueName, { message: 'pending' });

        const result = await service.listTasks({ status: 'pending' });

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks.length).toBeGreaterThanOrEqual(1);
        expect(tasks.every((t) => t.status === 'pending')).toBe(true);
      });

      it('filters by taskName', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-list-taskname`;
        await scheduleTask(queueName, { message: 'task 1' });
        await scheduleTask(queueName, { message: 'task 2' });

        const result = await service.listTasks({ taskName: queueName });

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks.length).toBe(2);
        expect(tasks.every((t) => t.taskName === queueName)).toBe(true);
      });

      it('filters by userId', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const userId = `user-list-${Date.now()}`;
        const queueName = `${testQueuePrefix}-list-userid`;
        await scheduleTask(queueName, { message: 'user task' }, { userId });

        const result = await service.listTasks({ userId: UserId(userId) });

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks.length).toBe(1);
        expect(tasks[0].userId).toBe(userId);
      });

      it('respects limit parameter', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-list-limit`;
        await scheduleTask(queueName, { message: 'task 1' });
        await scheduleTask(queueName, { message: 'task 2' });
        await scheduleTask(queueName, { message: 'task 3' });

        const result = await service.listTasks({
          taskName: queueName,
          limit: 2,
        });

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks.length).toBe(2);
      });

      it('respects offset parameter', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-list-offset`;
        await scheduleTask(queueName, { message: 'task 1' });
        await scheduleTask(queueName, { message: 'task 2' });
        await scheduleTask(queueName, { message: 'task 3' });

        // Get all tasks first
        const allResult = await service.listTasks({ taskName: queueName });
        const allTasks = allResult._unsafeUnwrap();

        // Get with offset
        const offsetResult = await service.listTasks({
          taskName: queueName,
          offset: 1,
        });

        expect(offsetResult.isOk()).toBe(true);
        const offsetTasks = offsetResult._unsafeUnwrap();
        expect(offsetTasks.length).toBe(allTasks.length - 1);
      });

      it('combines multiple filters', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const userId = `user-combo-${Date.now()}`;
        const queueName = `${testQueuePrefix}-list-combo`;

        await scheduleTask(queueName, { message: 'match' }, { userId });
        await scheduleTask(queueName, { message: 'no user match' });
        await scheduleTask(
          `${testQueuePrefix}-other`,
          { message: 'no name match' },
          { userId },
        );

        const result = await service.listTasks({
          taskName: queueName,
          userId: UserId(userId),
          status: 'pending',
        });

        expect(result.isOk()).toBe(true);
        const tasks = result._unsafeUnwrap();
        expect(tasks.length).toBe(1);
        expect(tasks[0].taskName).toBe(queueName);
        expect(tasks[0].userId).toBe(userId);
        expect(tasks[0].status).toBe('pending');
      });
    });

    describe('getQueueStats', () => {
      it('returns queue statistics for existing queue', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-stats`;
        await scheduleTask(queueName, { message: 'task 1' });
        await scheduleTask(queueName, { message: 'task 2' });

        const correlationId = CorrelationId();
        const result = await service.getQueueStats(correlationId, queueName);

        expect(result.isOk()).toBe(true);
        const stats = result._unsafeUnwrap();
        expect(stats.queueName).toBe(queueName);
        // Verify stats structure (actual counts may vary based on BullMQ/Redis state)
        expect(typeof stats.waiting).toBe('number');
        expect(typeof stats.active).toBe('number');
        expect(typeof stats.completed).toBe('number');
        expect(typeof stats.failed).toBe('number');
        expect(typeof stats.delayed).toBe('number');
        expect(stats.waiting).toBeGreaterThanOrEqual(0);
        expect(stats.active).toBeGreaterThanOrEqual(0);
        expect(stats.completed).toBeGreaterThanOrEqual(0);
        expect(stats.failed).toBeGreaterThanOrEqual(0);
        expect(stats.delayed).toBeGreaterThanOrEqual(0);
      });

      it('returns zero stats for empty queue', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-empty-queue`;
        const correlationId = CorrelationId();
        const result = await service.getQueueStats(correlationId, queueName);

        expect(result.isOk()).toBe(true);
        const stats = result._unsafeUnwrap();
        expect(stats.queueName).toBe(queueName);
        expect(stats.waiting).toBe(0);
        expect(stats.active).toBe(0);
        expect(stats.completed).toBe(0);
        expect(stats.failed).toBe(0);
        expect(stats.delayed).toBe(0);
      });
    });
  });

  describe('Operation Methods', () => {
    describe('cancelTask', () => {
      it('cancels a pending task', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-cancel`;
        const taskRecord = await scheduleTask(queueName, {
          message: 'to cancel',
        });

        const correlationId = CorrelationId();
        const result = await service.cancelTask(correlationId, taskRecord.id);

        expect(result.isOk()).toBe(true);
        const cancelledTask = result._unsafeUnwrap();
        expect(cancelledTask.id).toBe(taskRecord.id);
        expect(cancelledTask.status).toBe('cancelled');
      });

      it('cancels a delayed task', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-cancel-delayed`;
        const taskRecord = await scheduleTask(
          queueName,
          { message: 'delayed to cancel' },
          { delayMs: 60000 }, // 1 minute delay
        );

        expect(taskRecord.status).toBe('delayed');

        const correlationId = CorrelationId();
        const result = await service.cancelTask(correlationId, taskRecord.id);

        expect(result.isOk()).toBe(true);
        const cancelledTask = result._unsafeUnwrap();
        expect(cancelledTask.status).toBe('cancelled');
      });

      it('returns error for non-existent task', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const correlationId = CorrelationId();
        const fakeTaskId = TaskId('non-existent-task-id');
        const result = await service.cancelTask(correlationId, fakeTaskId);

        expect(result.isErr()).toBe(true);
      });

      it('returns error for already completed task', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });
        const repo = createTasksRepo({ appConfig: config });

        const queueName = `${testQueuePrefix}-cancel-completed`;
        const taskRecord = await scheduleTask(queueName, {
          message: 'completed',
        });

        // Manually mark as completed
        await repo.update(taskRecord.id, {
          status: 'completed',
          completedAt: new Date(),
        });

        const correlationId = CorrelationId();
        const result = await service.cancelTask(correlationId, taskRecord.id);

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toContain('Cannot cancel task');
      });
    });

    describe('retryTask', () => {
      it('retries a failed task', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });
        const repo = createTasksRepo({ appConfig: config });

        const queueName = `${testQueuePrefix}-retry`;
        const taskRecord = await scheduleTask(queueName, {
          message: 'to retry',
        });

        // Manually mark as failed
        await repo.update(taskRecord.id, {
          status: 'failed',
          failedAt: new Date(),
          error: {
            success: false,
            reason: 'Simulated failure',
            lastAttemptAt: new Date(),
          },
        });

        const correlationId = CorrelationId();
        const result = await service.retryTask(correlationId, taskRecord.id);

        expect(result.isOk()).toBe(true);
        const retriedTask = result._unsafeUnwrap();
        expect(retriedTask.id).toBe(taskRecord.id);
        expect(retriedTask.status).toBe('pending');
        expect(retriedTask.attempts).toBe(0); // Reset to 0
      });

      it('returns error for non-existent task', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const correlationId = CorrelationId();
        const fakeTaskId = TaskId('non-existent-task-id');
        const result = await service.retryTask(correlationId, fakeTaskId);

        expect(result.isErr()).toBe(true);
      });

      it('returns error for pending task', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-retry-pending`;
        const taskRecord = await scheduleTask(queueName, {
          message: 'still pending',
        });

        const correlationId = CorrelationId();
        const result = await service.retryTask(correlationId, taskRecord.id);

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toContain('Cannot retry task');
      });
    });
  });

  describe('Inherited SharedService Methods', () => {
    describe('get', () => {
      it('returns task by ID', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const queueName = `${testQueuePrefix}-get`;
        const taskRecord = await scheduleTask(queueName, {
          message: 'get by id',
        });

        const result = await service.get(taskRecord.id);

        expect(result.isOk()).toBe(true);
        const task = result._unsafeUnwrap();
        expect(task.id).toBe(taskRecord.id);
        expect(task.taskName).toBe(queueName);
        expect(task.payload).toEqual({ message: 'get by id' });
      });

      it('returns error for non-existent task', async () => {
        const config = getConfig();
        const logger = getLogger();
        const service = createTasksService({ logger, appConfig: config });

        const fakeTaskId = TaskId('non-existent-task-id');
        const result = await service.get(fakeTaskId);

        expect(result.isErr()).toBe(true);
      });
    });
  });
});
