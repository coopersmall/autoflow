import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { createInvalidTaskStateError } from '@backend/tasks/errors/TaskError';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface CancelTaskContext {
  tasksRepo: ITasksRepo;
  taskQueue: (queueName: string) => ITaskQueue;
  logger: ILogger;
}

export interface CancelTaskRequest {
  correlationId: CorrelationId;
  taskId: TaskId;
}

export async function cancelTask(
  ctx: CancelTaskContext,
  request: CancelTaskRequest,
): Promise<Result<TaskRecord, ErrorWithMetadata>> {
  const taskResult = await ctx.tasksRepo.get(request.taskId);
  if (taskResult.isErr()) return err(taskResult.error);

  const task = taskResult.value;

  if (task.status !== 'pending' && task.status !== 'delayed') {
    return err(createInvalidTaskStateError(task.status, 'cancel'));
  }

  const taskQueue = ctx.taskQueue(task.queueName);

  const removeResult = await taskQueue.remove(request.correlationId, task.id);

  if (removeResult.isErr()) {
    ctx.logger.error('Could not remove task from queue', removeResult.error, {
      taskId: task.id,
    });
  }

  const updateResult = await ctx.tasksRepo.update(task.id, {
    status: 'cancelled',
  });

  if (updateResult.isErr()) return err(updateResult.error);

  ctx.logger.info('Task cancelled', { taskId: task.id });

  return ok(updateResult.value);
}
