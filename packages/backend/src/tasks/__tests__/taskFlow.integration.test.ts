/**
 * End-to-end task flow integration tests.
 *
 * Tests the complete task lifecycle:
 * - Schedule → Process → Complete
 * - Schedule → Process → Fail → Retry → Complete
 * - Schedule delayed → Wait → Process
 * - Schedule → Cancel
 *
 * These tests require real Redis and PostgreSQL connections.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import { FAST_RETRY_CONFIG } from '@backend/infrastructure/queue/domain/QueueConfig';
import type { TaskContext } from '@backend/tasks/domain/TaskContext';
import { defineTask } from '@backend/tasks/domain/TaskDefinition';
import type { TaskError } from '@backend/tasks/domain/TaskError';
import type { TaskResult } from '@backend/tasks/domain/TaskResult';
import { createTaskQueue } from '@backend/tasks/queue/TaskQueue';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import { createTaskScheduler } from '@backend/tasks/scheduler/TaskScheduler';
import { createTaskWorker } from '@backend/tasks/worker/TaskWorker';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { CorrelationId } from '@core/domain/CorrelationId';
import { validate } from '@core/validation/validate';
import * as fc from 'fast-check';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';

describe('Task Flow Integration Tests', () => {
  const { getConfig, getLogger } = setupIntegrationTest();

  // Test payloads
  const testPayloadSchema = zod.object({
    message: zod.string(),
    shouldFail: zod.boolean().optional(),
    delayMs: zod.number().optional(),
  });

  type TestPayload = zod.infer<typeof testPayloadSchema>;

  const testValidator = (data: unknown) => validate(testPayloadSchema, data);

  // Track processed tasks for assertions
  let processedTasks: Array<{ taskId: string; payload: TestPayload }> = [];
  let failureCount = 0;

  // Create test task definition with proper return types
  const createTestTaskDefinition = (
    queueName: string,
    options?: { maxAttempts?: number },
  ) => {
    const handler = async (
      payload: TestPayload,
      ctx: TaskContext,
    ): Promise<Result<TaskResult, TaskError>> => {
      const startTime = Date.now();

      // Simulate processing delay
      if (payload.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, payload.delayMs));
      }

      // Simulate failure if requested
      if (payload.shouldFail) {
        failureCount++;
        return err({
          success: false as const,
          reason: 'Simulated task failure',
          lastAttemptAt: new Date(),
        });
      }

      processedTasks.push({
        taskId: ctx.taskId,
        payload,
      });

      return ok({
        success: true as const,
        duration: Date.now() - startTime,
        output: { processed: true },
      });
    };

    return defineTask<TestPayload>({
      queueName,
      validator: testValidator,
      handler,
      options: {
        maxAttempts: options?.maxAttempts ?? 3,
        priority: 'normal',
      },
    });
  };

  beforeEach(() => {
    processedTasks = [];
    failureCount = 0;
  });

  describe('Property Tests', () => {
    // Arbitraries for property-based testing
    const validPayloadArb = fc.record({
      message: fc.string({ minLength: 1, maxLength: 1000 }),
      shouldFail: fc.option(fc.boolean(), { nil: undefined }),
      delayMs: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
    });

    const invalidPayloadArb = fc.oneof(
      // Missing required 'message' field
      fc.record({
        wrongField: fc.string(),
      }),
      // message is not a string
      fc.record({
        message: fc.integer(),
        shouldFail: fc.boolean(),
      }),
      // Completely invalid structure
      fc.constant(null),
      fc.constant(undefined),
      fc.constant('not an object'),
    );

    it('should accept all valid payloads that match schema', async () => {
      const config = getConfig();
      const logger = getLogger();
      const queueName = `test-queue-valid-${Date.now()}`;
      const testTask = createTestTaskDefinition(queueName);
      const scheduler = createTaskScheduler({ logger, appConfig: config });

      await fc.assert(
        fc.asyncProperty(validPayloadArb, async (payload) => {
          const correlationId = CorrelationId();
          const ctx = createMockContext({ correlationId });
          const scheduleResult = await scheduler.schedule(
            ctx,
            testTask,
            payload,
          );

          // All valid payloads should be accepted and scheduled
          expect(scheduleResult.isOk()).toBe(true);
          if (scheduleResult.isOk()) {
            const task = scheduleResult.value;
            expect(task.status).toMatch(/pending|delayed/);
            expect(task.taskName).toBe(queueName);
          }
        }),
        { numRuns: 30 },
      );
    });

    it('should reject payloads that do not match schema', async () => {
      const config = getConfig();
      const logger = getLogger();
      const queueName = `test-queue-invalid-${Date.now()}`;
      const testTask = createTestTaskDefinition(queueName);
      const scheduler = createTaskScheduler({ logger, appConfig: config });

      await fc.assert(
        fc.asyncProperty(invalidPayloadArb, async (invalidPayload) => {
          const correlationId = CorrelationId();
          const ctx = createMockContext({ correlationId });
          const scheduleResult = await scheduler.schedule(
            ctx,
            testTask,
            invalidPayload as unknown as TestPayload,
          );

          // All invalid payloads should be rejected
          expect(scheduleResult.isErr()).toBe(true);
          if (scheduleResult.isErr()) {
            const error = scheduleResult.error;
            expect(error.message).toContain('validation');
          }
        }),
        { numRuns: 30 },
      );
    });
  });

  describe('Schedule → Process → Complete', () => {
    it('should complete a task successfully', async () => {
      const config = getConfig();
      const logger = getLogger();
      const queueName = `test-queue-${Date.now()}`;
      const testTask = createTestTaskDefinition(queueName);

      // Create scheduler and worker
      const scheduler = createTaskScheduler({ logger, appConfig: config });
      const worker = createTaskWorker({
        logger,
        appConfig: config,
        task: testTask,
      });

      try {
        // Start worker
        const startResult = await worker.start();
        expect(startResult.isOk()).toBe(true);

        // Schedule task
        const correlationId = CorrelationId();
        const ctx = createMockContext({ correlationId });
        const scheduleResult = await scheduler.schedule(ctx, testTask, {
          message: 'Hello, World!',
        });

        expect(scheduleResult.isOk()).toBe(true);
        const taskRecord = scheduleResult._unsafeUnwrap();
        expect(taskRecord.status).toBe('pending');
        expect(taskRecord.taskName).toBe(queueName);

        // Wait for task to be processed
        await waitForCondition(
          () => processedTasks.length > 0,
          5000,
          'Task was not processed in time',
        );

        // Verify task was processed
        expect(processedTasks.length).toBe(1);
        expect(processedTasks[0].payload.message).toBe('Hello, World!');

        // Verify task status in database
        const repo = createTasksRepo({ appConfig: config });
        const getResult = await repo.get(ctx, taskRecord.id);
        expect(getResult.isOk()).toBe(true);
        const updatedTask = getResult._unsafeUnwrap();
        expect(updatedTask.status).toBe('completed');
        expect(updatedTask.completedAt).toBeDefined();

        // Verify queue is empty
        const queue = createTaskQueue({
          queueName,
          logger,
          appConfig: config,
        });
        const queueCountsResult = await queue.getJobCounts(ctx);
        expect(queueCountsResult.isOk()).toBe(true);
        const counts = queueCountsResult._unsafeUnwrap();
        expect(counts.waiting).toBe(0);
        expect(counts.active).toBe(0);
        expect(counts.failed).toBe(0);
        expect(counts.completed).toBe(1);
      } finally {
        await worker.stop();
      }
    });

    it('should process multiple tasks concurrently', async () => {
      const config = getConfig();
      const logger = getLogger();
      const queueName = `test-queue-concurrent-${Date.now()}`;
      const testTask = createTestTaskDefinition(queueName);

      const scheduler = createTaskScheduler({ logger, appConfig: config });
      const worker = createTaskWorker({
        logger,
        appConfig: config,
        task: testTask,
      });

      try {
        await worker.start();

        // Schedule multiple tasks
        const correlationId = CorrelationId();
        const ctx = createMockContext({ correlationId });
        const promises = Array.from({ length: 5 }, (_, i) =>
          scheduler.schedule(ctx, testTask, {
            message: `Task ${i + 1}`,
          }),
        );

        const results = await Promise.all(promises);
        expect(results.every((r) => r.isOk())).toBe(true);

        // Wait for all tasks to be processed
        await waitForCondition(
          () => processedTasks.length >= 5,
          10000,
          'Not all tasks were processed in time',
        );

        expect(processedTasks.length).toBe(5);
      } finally {
        await worker.stop();
      }

      // Verify all tasks were processed
      const queue = createTaskQueue({
        queueName,
        logger,
        appConfig: config,
      });

      const queueCountsResult = await queue.getJobCounts(createMockContext());
      expect(queueCountsResult.isOk()).toBe(true);
      const counts = queueCountsResult._unsafeUnwrap();
      expect(counts.waiting).toBe(0);
      expect(counts.active).toBe(0);
      expect(counts.failed).toBe(0);
      expect(counts.completed).toBe(5);
    });
  });

  describe('Schedule → Process → Fail → Retry', () => {
    // This test uses FAST_RETRY_CONFIG (100ms backoff) for fast execution
    // With maxAttempts=3 and 100ms exponential backoff:
    // - Attempt 1: immediate
    // - Attempt 2: after 100ms delay
    // - Attempt 3: after 200ms delay
    // Total: ~300ms + processing time
    it('should retry failed task and eventually fail permanently', async () => {
      const config = getConfig();
      const logger = getLogger();
      const queueName = `test-queue-fail-${Date.now()}`;
      const testTask = createTestTaskDefinition(queueName);

      // Use fast retry config for quick test execution
      const scheduler = createTaskScheduler({
        logger,
        appConfig: config,
        queueConfig: FAST_RETRY_CONFIG,
      });
      const worker = createTaskWorker({
        logger,
        appConfig: config,
        task: testTask,
      });

      try {
        await worker.start();

        // Schedule a task that will always fail
        const correlationId = CorrelationId();
        const ctx = createMockContext({ correlationId });
        const scheduleResult = await scheduler.schedule(ctx, testTask, {
          message: 'Will fail',
          shouldFail: true,
        });

        expect(scheduleResult.isOk()).toBe(true);
        const taskRecord = scheduleResult._unsafeUnwrap();

        // Wait for retries to exhaust (maxAttempts = 3)
        // With fast backoff (100ms, 200ms), this should complete quickly
        await waitForCondition(
          () => failureCount >= 3,
          5000,
          'Task did not exhaust retries in time',
        );

        // Give time for the final status update
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify task ended up in failed state
        const repo = createTasksRepo({ appConfig: config });
        const getResult = await repo.get(ctx, taskRecord.id);
        expect(getResult.isOk()).toBe(true);
        const updatedTask = getResult._unsafeUnwrap();
        expect(updatedTask.status).toBe('failed');
        expect(updatedTask.failedAt).toBeDefined();
        expect(updatedTask.error).toBeDefined();
      } finally {
        await worker.stop();
      }
    });
  });

  describe('Schedule → Cancel', () => {
    it('should cancel a pending task', async () => {
      const config = getConfig();
      const logger = getLogger();
      const queueName = `test-queue-cancel-${Date.now()}`;
      const testTask = createTestTaskDefinition(queueName);

      const scheduler = createTaskScheduler({ logger, appConfig: config });

      // Schedule task but don't start worker
      const correlationId = CorrelationId();
      const ctx = createMockContext({ correlationId });
      const scheduleResult = await scheduler.schedule(ctx, testTask, {
        message: 'Will be cancelled',
      });

      expect(scheduleResult.isOk()).toBe(true);
      const taskRecord = scheduleResult._unsafeUnwrap();

      // Cancel the task directly in the database
      const repo = createTasksRepo({ appConfig: config });
      const cancelResult = await repo.update(ctx, taskRecord.id, {
        status: 'cancelled',
      });

      expect(cancelResult.isOk()).toBe(true);
      const cancelledTask = cancelResult._unsafeUnwrap();
      expect(cancelledTask.status).toBe('cancelled');

      // Verify task was not processed
      expect(processedTasks.length).toBe(0);
    });
  });

  describe('Delayed tasks', () => {
    it('should schedule and process delayed task', async () => {
      const config = getConfig();
      const logger = getLogger();
      const queueName = `test-queue-delayed-${Date.now()}`;
      const testTask = createTestTaskDefinition(queueName);

      const scheduler = createTaskScheduler({ logger, appConfig: config });
      const worker = createTaskWorker({
        logger,
        appConfig: config,
        task: testTask,
      });

      try {
        await worker.start();

        // Schedule task with 1 second delay
        const correlationId = CorrelationId();
        const ctx = createMockContext({ correlationId });
        const scheduleResult = await scheduler.schedule(
          ctx,
          testTask,
          { message: 'Delayed task' },
          { delayMs: 1000 },
        );

        expect(scheduleResult.isOk()).toBe(true);
        const taskRecord = scheduleResult._unsafeUnwrap();
        expect(taskRecord.status).toBe('delayed');
        expect(taskRecord.delayUntil).toBeDefined();

        // Verify task is not processed immediately
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(processedTasks.length).toBe(0);

        // Wait for task to be processed after delay
        await waitForCondition(
          () => processedTasks.length > 0,
          5000,
          'Delayed task was not processed in time',
        );

        expect(processedTasks.length).toBe(1);
        expect(processedTasks[0].payload.message).toBe('Delayed task');

        // Verify task status in database
        const repo = createTasksRepo({ appConfig: config });
        const getResult = await repo.get(ctx, taskRecord.id);
        expect(getResult.isOk()).toBe(true);
        const updatedTask = getResult._unsafeUnwrap();
        expect(updatedTask.status).toBe('completed');

        // Verify queue is empty
        const queue = createTaskQueue({
          queueName,
          logger,
          appConfig: config,
        });

        const queueCountsResult = await queue.getJobCounts(ctx);
        expect(queueCountsResult.isOk()).toBe(true);
        const counts = queueCountsResult._unsafeUnwrap();
        expect(counts.waiting).toBe(0);
        expect(counts.active).toBe(0);
        expect(counts.failed).toBe(0);
        expect(counts.completed).toBe(1);
      } finally {
        await worker.stop();
      }
    });
  });

  describe('Task validation', () => {
    it('should reject task with invalid payload', async () => {
      const config = getConfig();
      const logger = getLogger();
      const queueName = `test-queue-validation-${Date.now()}`;
      const testTask = createTestTaskDefinition(queueName);

      const scheduler = createTaskScheduler({ logger, appConfig: config });

      // Schedule task with invalid payload (missing required 'message' field)
      const correlationId = CorrelationId();
      const ctx = createMockContext({ correlationId });
      const invalidPayload = { invalidField: 'test' } as unknown as TestPayload;
      const scheduleResult = await scheduler.schedule(
        ctx,
        testTask,
        invalidPayload,
      );

      expect(scheduleResult.isErr()).toBe(true);
      expect(scheduleResult._unsafeUnwrapErr().message).toContain('validation');
    });
  });
});

/**
 * Helper to wait for a condition with timeout.
 */
async function waitForCondition(
  condition: () => boolean,
  timeoutMs: number,
  errorMessage: string,
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(errorMessage);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
