import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { createInvalidTaskStateError } from '@backend/tasks/errors/TaskError';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface RetryTaskDeps {
  logger: ILogger;
  tasksRepo: ITasksRepo;
  taskQueue: (queueName: string) => ITaskQueue;
}

export interface RetryTaskRequest {
  taskId: TaskId;
}

export async function retryTask(
  ctx: Context,
  request: RetryTaskRequest,
  deps: RetryTaskDeps,
): Promise<Result<TaskRecord, AppError>> {
  const taskResult = await deps.tasksRepo.get(ctx, request.taskId);
  if (taskResult.isErr()) return err(taskResult.error);

  const task = taskResult.value;

  if (task.status !== 'failed') {
    return err(createInvalidTaskStateError(task.status, 'retry'));
  }

  const updateResult = await deps.tasksRepo.update(ctx, task.id, {
    status: 'pending',
    attempts: 0,
    failedAt: null,
    error: null,
  });

  if (updateResult.isErr()) return err(updateResult.error);

  const taskQueue = deps.taskQueue(task.queueName);

  const enqueueResult = await taskQueue.enqueue(ctx, updateResult.value);

  if (enqueueResult.isErr()) return err(enqueueResult.error);

  deps.logger.info('Task re-queued', {
    taskId: task.id,
    jobId: enqueueResult.value.id,
  });

  return ok(updateResult.value);
}
