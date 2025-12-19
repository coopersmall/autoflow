import { describe, expect, it, mock } from 'bun:test';
import { defineTask } from '@backend/tasks/domain/TaskDefinition';
import { DEFAULT_TASK_OPTIONS } from '@backend/tasks/domain/TaskOptions';
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
  });
});
