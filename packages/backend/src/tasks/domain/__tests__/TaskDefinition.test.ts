import { describe, expect, it, mock } from 'bun:test';
import type { TaskContext } from '@backend/tasks/domain/TaskContext';
import { defineTask } from '@backend/tasks/domain/TaskDefinition';
import { TaskId } from '@backend/tasks/domain/TaskId';
import { DEFAULT_TASK_OPTIONS } from '@backend/tasks/domain/TaskOptions';
import { CorrelationId } from '@core/domain/CorrelationId';
import { validate } from '@core/validation/validate';
import { ok } from 'neverthrow';
import zod from 'zod';

// Test payload schema
const testPayloadSchema = zod.object({
  email: zod.string().email(),
  name: zod.string(),
});

type TestPayload = zod.infer<typeof testPayloadSchema>;

const testValidator = (data: unknown) => validate(testPayloadSchema, data);

describe('defineTask', () => {
  describe('basic task definition', () => {
    it('should create a TaskDefinition with all required fields', () => {
      const handler = mock().mockReturnValue(ok({ success: true }));

      const task = defineTask<TestPayload>({
        queueName: 'test:send-email',
        validator: testValidator,
        handler,
      });

      expect(task.queueName).toBe('test:send-email');
      expect(task.validator).toBe(testValidator);
      expect(task.handler).toBe(handler);
      expect(task.options).toBeDefined();
    });

    it('should preserve the validator function', () => {
      const handler = mock().mockReturnValue(ok({ success: true }));

      const task = defineTask<TestPayload>({
        queueName: 'test:send-email',
        validator: testValidator,
        handler,
      });

      // Valid payload should pass
      const validResult = task.validator({
        email: 'test@example.com',
        name: 'John',
      });
      expect(validResult.isOk()).toBe(true);

      // Invalid payload should fail
      const invalidResult = task.validator({
        email: 'not-an-email',
        name: 'John',
      });
      expect(invalidResult.isErr()).toBe(true);
    });

    it('should preserve the handler function', async () => {
      const handler = mock().mockReturnValue(
        ok({ success: true, duration: 100 }),
      );

      const task = defineTask<TestPayload>({
        queueName: 'test:send-email',
        validator: testValidator,
        handler,
      });

      const payload = { email: 'test@example.com', name: 'John' };
      const context: TaskContext = {
        correlationId: CorrelationId('corr-123'),
        taskId: TaskId('task-123'),
        logger: { info: mock(), error: mock(), debug: mock() },
      };

      const result = await task.handler(payload, context);

      expect(handler).toHaveBeenCalledWith(payload, context);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({ success: true, duration: 100 });
    });
  });

  describe('default options', () => {
    it('should apply default options when none provided', () => {
      const handler = mock().mockReturnValue(ok({ success: true }));

      const task = defineTask<TestPayload>({
        queueName: 'test:send-email',
        validator: testValidator,
        handler,
      });

      expect(task.options).toEqual(DEFAULT_TASK_OPTIONS);
      expect(task.options.priority).toBe('normal');
      expect(task.options.maxAttempts).toBe(3);
      expect(task.options.backoffMs).toBe(1000);
      expect(task.options.timeoutMs).toBe(30000);
    });
  });

  describe('custom options', () => {
    it('should merge custom options with defaults', () => {
      const handler = mock().mockReturnValue(ok({ success: true }));

      const task = defineTask<TestPayload>({
        queueName: 'test:send-email',
        validator: testValidator,
        handler,
        options: {
          priority: 'high',
          maxAttempts: 5,
        },
      });

      expect(task.options.priority).toBe('high');
      expect(task.options.maxAttempts).toBe(5);
      // Defaults should still be applied for unspecified options
      expect(task.options.backoffMs).toBe(1000);
      expect(task.options.timeoutMs).toBe(30000);
    });

    it('should allow overriding all options', () => {
      const handler = mock().mockReturnValue(ok({ success: true }));

      const task = defineTask<TestPayload>({
        queueName: 'test:send-email',
        validator: testValidator,
        handler,
        options: {
          priority: 'low',
          maxAttempts: 1,
          backoffMs: 5000,
          timeoutMs: 60000,
        },
      });

      expect(task.options.priority).toBe('low');
      expect(task.options.maxAttempts).toBe(1);
      expect(task.options.backoffMs).toBe(5000);
      expect(task.options.timeoutMs).toBe(60000);
    });

    it('should support critical priority', () => {
      const handler = mock().mockReturnValue(ok({ success: true }));

      const task = defineTask<TestPayload>({
        queueName: 'test:critical-task',
        validator: testValidator,
        handler,
        options: {
          priority: 'critical',
        },
      });

      expect(task.options.priority).toBe('critical');
    });
  });

  describe('type safety', () => {
    it('should infer payload type from validator', () => {
      const handler = mock().mockReturnValue(ok({ success: true }));

      const task = defineTask({
        queueName: 'test:send-email',
        validator: testValidator,
        handler,
      });

      // TypeScript should infer the correct type
      // This test verifies the task definition compiles correctly
      expect(task.queueName).toBe('test:send-email');
    });

    it('should work with complex payload types', () => {
      const complexSchema = zod.object({
        user: zod.object({
          id: zod.string(),
          email: zod.string().email(),
          preferences: zod.object({
            notifications: zod.boolean(),
          }),
        }),
        items: zod.array(
          zod.object({
            productId: zod.string(),
            quantity: zod.number().int().positive(),
          }),
        ),
        metadata: zod.record(zod.unknown()).optional(),
      });

      const complexValidator = (data: unknown) => validate(complexSchema, data);
      const handler = mock().mockReturnValue(ok({ processed: true }));

      const task = defineTask({
        queueName: 'orders:process',
        validator: complexValidator,
        handler,
      });

      const validPayload = {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          preferences: { notifications: true },
        },
        items: [{ productId: 'prod-1', quantity: 2 }],
      };

      const result = task.validator(validPayload);
      expect(result.isOk()).toBe(true);
    });
  });

  describe('queue name conventions', () => {
    it('should accept namespaced queue names', () => {
      const handler = mock().mockReturnValue(ok({ success: true }));

      const task = defineTask<TestPayload>({
        queueName: 'users:notifications:send-welcome-email',
        validator: testValidator,
        handler,
      });

      expect(task.queueName).toBe('users:notifications:send-welcome-email');
    });

    it('should accept simple queue names', () => {
      const handler = mock().mockReturnValue(ok({ success: true }));

      const task = defineTask<TestPayload>({
        queueName: 'cleanup',
        validator: testValidator,
        handler,
      });

      expect(task.queueName).toBe('cleanup');
    });
  });
});
