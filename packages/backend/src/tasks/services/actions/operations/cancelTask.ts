import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { createInvalidTaskStateError } from '@backend/tasks/errors/TaskError';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface CancelTaskDeps {
  tasksRepo: ITasksRepo;
  taskQueue: (queueName: string) => ITaskQueue;
  logger: ILogger;
}

export interface CancelTaskRequest {
  taskId: TaskId;
}

export async function cancelTask(
  ctx: Context,
  request: CancelTaskRequest,
  deps: CancelTaskDeps,
): Promise<Result<TaskRecord, AppError>> {
  const taskResult = await deps.tasksRepo.get(ctx, request.taskId);
  if (taskResult.isErr()) return err(taskResult.error);

  const task = taskResult.value;

  if (task.status !== 'pending' && task.status !== 'delayed') {
    return err(createInvalidTaskStateError(task.status, 'cancel'));
  }

  const taskQueue = deps.taskQueue(task.queueName);

  const removeResult = await taskQueue.remove(ctx, task.id);

  if (removeResult.isErr()) {
    deps.logger.error('Could not remove task from queue', removeResult.error, {
      taskId: task.id,
    });
  }

  const updateResult = await deps.tasksRepo.update(ctx, task.id, {
    status: 'cancelled',
  });

  if (updateResult.isErr()) return err(updateResult.error);

  deps.logger.info('Task cancelled', { taskId: task.id });

  return ok(updateResult.value);
}
