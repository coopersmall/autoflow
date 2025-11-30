import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { createInvalidTaskStateError } from '@backend/tasks/errors/TaskError';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface RetryTaskContext {
  logger: ILogger;
  tasksRepo: ITasksRepo;
  taskQueue: (queueName: string) => ITaskQueue;
}

export interface RetryTaskRequest {
  correlationId: CorrelationId;
  taskId: TaskId;
}

export async function retryTask(
  ctx: RetryTaskContext,
  request: RetryTaskRequest,
): Promise<Result<TaskRecord, ErrorWithMetadata>> {
  const taskResult = await ctx.tasksRepo.get(request.taskId);
  if (taskResult.isErr()) return err(taskResult.error);

  const task = taskResult.value;

  if (task.status !== 'failed') {
    return err(createInvalidTaskStateError(task.status, 'retry'));
  }

  const updateResult = await ctx.tasksRepo.update(task.id, {
    status: 'pending',
    attempts: 0,
    failedAt: null,
    error: null,
  });

  if (updateResult.isErr()) return err(updateResult.error);

  const taskQueue = ctx.taskQueue(task.queueName);

  const enqueueResult = await taskQueue.enqueue(
    request.correlationId,
    updateResult.value,
  );

  if (enqueueResult.isErr()) return err(enqueueResult.error);

  ctx.logger.info('Task re-queued', {
    taskId: task.id,
    jobId: enqueueResult.value.id,
  });

  return ok(updateResult.value);
}
