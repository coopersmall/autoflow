# Background Tasks Guide

Autoflow uses a type-safe task queue system for background processing. This guide explains how to create, schedule, and process tasks.

## Overview

The task system provides:
- **Type-safe payloads** with Zod validation
- **Automatic retries** with configurable strategies
- **Priority queues** for task ordering
- **Result types** for error handling
- **Correlation IDs** for tracing

## Quick Start

```typescript
// 1. Define task
const sendEmailTask = defineTask({
  queueName: 'emails:send',
  validator: (data) => validate(emailPayloadSchema, data),
  handler: async (payload, ctx) => {
    await sendEmail(payload);
    return ok({ success: true, duration: 150 });
  },
  options: { priority: 'high', maxAttempts: 3 },
});

// 2. Register in tasks.config.ts
export const tasks = [sendEmailTask];

// 3. Schedule from services
const scheduler = createTaskScheduler({ logger, appConfig });
await scheduler.schedule(correlationId, sendEmailTask, {
  to: 'user@example.com',
  subject: 'Welcome!',
});
```

## Defining Tasks

### Basic Task Definition

```typescript
import { defineTask } from '@backend/tasks/domain/TaskDefinition';
import { validate } from '@core/validation/validate';
import { ok, err } from 'neverthrow';
import zod from 'zod';

// 1. Define payload schema
const welcomeEmailPayloadSchema = zod.object({
  userId: userIdSchema,
  email: zod.string().email(),
  name: zod.string(),
});

type WelcomeEmailPayload = zod.infer<typeof welcomeEmailPayloadSchema>;

// 2. Define task
export const sendWelcomeEmailTask = defineTask({
  queueName: 'users:send-welcome-email',
  
  validator: (data) => validate(welcomeEmailPayloadSchema, data),
  
  handler: async (payload: WelcomeEmailPayload, ctx) => {
    ctx.logger.info('Sending welcome email', {
      correlationId: ctx.correlationId,
      email: payload.email,
    });
    
    // Perform the task
    await sendEmail({
      to: payload.email,
      subject: `Welcome, ${payload.name}!`,
      body: getWelcomeEmailTemplate(payload.name),
    });
    
    return ok({
      success: true,
      duration: 150,
    });
  },
  
  options: {
    priority: 'high',
    maxAttempts: 3,
    backoffMs: 1000,
  },
});
```

### Task Options

```typescript
interface TaskOptions {
  priority?: 'low' | 'normal' | 'high';  // Default: 'normal'
  maxAttempts?: number;                   // Default: 3
  backoffMs?: number;                     // Default: 1000
  timeoutMs?: number;                     // Default: 30000
}
```

## Task Context

Every task handler receives a `TaskContext`:

```typescript
interface TaskContext {
  correlationId: CorrelationId;  // For tracing
  logger: ILogger;               // For logging
  attempt: number;               // Current attempt number
  maxAttempts: number;           // Max attempts allowed
}
```

## Scheduling Tasks

### From Services

```typescript
import { createTaskScheduler } from '@backend/tasks/scheduler/TaskScheduler';

class UsersService extends SharedService<UserId, User> {
  async create(data: PartialUser): Promise<Result<User, Error>> {
    // Create user
    const userResult = await this.repo.create(data);
    if (userResult.isErr()) {
      return err(userResult.error);
    }
    
    const user = userResult.value;
    
    // Schedule welcome email task
    const scheduler = createTaskScheduler({
      logger: this.context.logger,
      appConfig: this.context.appConfig(),
    });
    
    await scheduler.schedule(
      CorrelationId(),
      sendWelcomeEmailTask,
      {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
    );
    
    return ok(user);
  }
}
```

### With Options

```typescript
await scheduler.schedule(
  correlationId,
  sendEmailTask,
  { email: 'user@example.com' },
  {
    userId,           // User-scoped task
    delayMs: 5000,    // Delay 5 seconds
  },
);
```

## Registering Tasks

Add your task to `tasks.config.ts`:

```typescript
// packages/backend/src/tasks/tasks.config.ts

import { sendWelcomeEmailTask } from '@backend/services/users/tasks/sendWelcomeEmailTask';
import { cleanupExpiredSecretsTask } from '@backend/services/secrets/tasks/cleanupExpiredSecretsTask';

export const tasks: TaskDefinition<unknown>[] = [
  sendWelcomeEmailTask,
  cleanupExpiredSecretsTask,
  // Add more tasks here
];
```

## Error Handling

### Return Errors

```typescript
handler: async (payload, ctx) => {
  try {
    await riskyOperation(payload);
    return ok({ success: true, duration: 100 });
  } catch (error) {
    ctx.logger.error('Task failed', error, { payload });
    return err(new TaskError('Operation failed', { payload }));
  }
}
```

### Automatic Retries

Tasks automatically retry on error up to `maxAttempts`:

```typescript
const retryableTask = defineTask({
  queueName: 'api:call-external',
  validator: validPayload,
  handler: async (payload, ctx) => {
    ctx.logger.info('Attempt', {
      attempt: ctx.attempt,
      maxAttempts: ctx.maxAttempts,
    });
    
    const result = await callExternalAPI(payload);
    
    if (result.isErr()) {
      // Will retry automatically if attempts < maxAttempts
      return err(new TaskError('API call failed'));
    }
    
    return ok({ success: true, duration: 200 });
  },
  options: {
    maxAttempts: 5,      // Retry up to 5 times
    backoffMs: 2000,     // Wait 2s between retries
  },
});
```

## Task Patterns

### Batch Processing

```typescript
const processBatchTask = defineTask({
  queueName: 'data:process-batch',
  validator: (data) => validate(batchPayloadSchema, data),
  handler: async (payload, ctx) => {
    const results = [];
    
    for (const item of payload.items) {
      const result = await processItem(item);
      results.push(result);
      
      ctx.logger.debug('Processed item', {
        itemId: item.id,
        result,
      });
    }
    
    return ok({
      success: true,
      processed: results.length,
      duration: Date.now() - payload.startTime,
    });
  },
});
```

### Scheduled/Recurring Tasks

```typescript
// Schedule a task to run periodically
const cleanupTask = defineTask({
  queueName: 'system:cleanup',
  validator: validCleanupPayload,
  handler: async (payload, ctx) => {
    const deleted = await cleanupExpiredData();
    
    ctx.logger.info('Cleanup complete', {
      deletedCount: deleted.length,
    });
    
    // Schedule next cleanup
    const scheduler = createTaskScheduler({
      logger: ctx.logger,
      appConfig: getAppConfig(),
    });
    
    await scheduler.schedule(
      CorrelationId(),
      cleanupTask,
      { scheduledAt: Date.now() },
      { delayMs: 24 * 60 * 60 * 1000 },  // 24 hours
    );
    
    return ok({ success: true, deletedCount: deleted.length });
  },
});
```

## Testing Tasks

### Unit Testing Task Handlers

```typescript
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { sendWelcomeEmailTask } from './sendWelcomeEmailTask';
import { CorrelationId } from '@core/domain/CorrelationId';
import { UserId } from '@core/domain/user/user';
import { describe, expect, it } from 'bun:test';

describe('sendWelcomeEmailTask', () => {
  it('should send welcome email', async () => {
    expect.assertions(2);
    
    const mockLogger = getMockedLogger();
    
    const payload = {
      userId: UserId(),
      email: 'test@example.com',
      name: 'Test User',
    };
    
    const ctx = {
      correlationId: CorrelationId(),
      logger: mockLogger,
      attempt: 1,
      maxAttempts: 3,
    };
    
    const result = await sendWelcomeEmailTask.handler(payload, ctx);
    
    expect(result.isOk()).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Sending welcome email',
      expect.objectContaining({ email: payload.email }),
    );
  });
});
```

## Running Workers

### Development

```bash
make dev-worker
```

### Production

```bash
make start-worker
```

## Best Practices

1. **Validate payloads** - Always use Zod schemas
2. **Use correlation IDs** - Track task execution
3. **Log generously** - Include context for debugging
4. **Handle errors** - Return `err()` instead of throwing
5. **Set appropriate timeouts** - Prevent hanging tasks
6. **Use idempotency** - Tasks may be retried
7. **Keep tasks focused** - One responsibility per task
8. **Monitor task queues** - Watch for failures and backlogs

## Next Steps

- [Services Guide](./services.md) - Schedule tasks from services
- [Testing Guide](./testing.md) - Test task handlers
- [Architecture Guide](./architecture.md) - Understand Result types

## Resources

- [BullMQ Documentation](https://docs.bullmq.io/)
