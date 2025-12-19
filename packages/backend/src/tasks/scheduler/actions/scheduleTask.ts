import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { TaskDefinition } from '@backend/tasks/domain/TaskDefinition';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import { newTaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import type { UserId } from '@core/domain/user/user';
import { type AppError, badRequest } from '@core/errors';
import { err, ok, type Result } from 'neverthrow';

export interface ScheduleTaskDeps {
  readonly tasksRepo: ITasksRepo;
  readonly logger: ILogger;
  readonly getQueue: (queueName: string) => ITaskQueue;
}

export interface ScheduleTaskRequest<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  readonly task: TaskDefinition<TPayload>;
  readonly payload: TPayload;
  readonly options?: {
    userId?: UserId;
    delayMs?: number;
  };
}

/**
 * Schedules a task for execution.
 *
 * Orchestration flow:
 * 1. Validate payload using task's validator
 * 2. Create task record in database
 * 3. Enqueue to queue
 * 4. Log success
 */
export async function scheduleTask<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
>(
  ctx: Context,
  request: ScheduleTaskRequest<TPayload>,
  deps: ScheduleTaskDeps,
): Promise<Result<TaskRecord, AppError>> {
  const { tasksRepo, logger, getQueue } = deps;
  const { task, payload, options } = request;
  const correlationId = ctx.correlationId;

  // Validate payload using task's validator
  const validationResult = task.validator(payload);
  if (validationResult.isErr()) {
    const error = badRequest('Task payload validation failed', {
      metadata: {
        correlationId,
        queueName: task.queueName,
        validationError: validationResult.error.message,
      },
    });
    logger.error('Task payload validation failed', error, {
      correlationId,
      queueName: task.queueName,
    });
    return err(error);
  }

  // Determine if delayed
  const delayMs = options?.delayMs ?? 0;
  const isDelayed = delayMs > 0;

  // Create task record
  const taskRecord = newTaskRecord(task.queueName, task.queueName, {
    payload: payload,
    status: isDelayed ? 'delayed' : 'pending',
    priority: task.options.priority,
    attempts: 0,
    maxAttempts: task.options.maxAttempts,
    enqueuedAt: new Date(),
    delayUntil: isDelayed ? new Date(Date.now() + delayMs) : undefined,
    userId: options?.userId,
  });

  // Save to database
  const createResult = await tasksRepo.create(ctx, taskRecord.id, taskRecord);
  if (createResult.isErr()) {
    logger.error('Failed to create task record', createResult.error, {
      correlationId,
      queueName: task.queueName,
    });
    return err(createResult.error);
  }

  // Enqueue to queue
  const queue = getQueue(task.queueName);
  const enqueueResult = await queue.enqueue(ctx, createResult.value);
  if (enqueueResult.isErr()) {
    logger.error('Failed to enqueue task', enqueueResult.error, {
      correlationId,
      taskId: taskRecord.id,
      queueName: task.queueName,
    });
    return err(enqueueResult.error);
  }

  logger.info('Task scheduled', {
    correlationId,
    taskId: taskRecord.id,
    queueName: task.queueName,
    priority: task.options.priority,
    delayed: isDelayed,
  });

  return ok(createResult.value);
}
