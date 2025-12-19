import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IQueueClient } from '@backend/infrastructure/queue/domain/QueueClient';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';

export interface RemoveTaskDeps {
  readonly client: IQueueClient;
  readonly logger: ILogger;
  readonly queueName: string;
}

export interface RemoveTaskRequest {
  readonly taskId: TaskId;
}

/**
 * Removes a task from the queue by task ID.
 *
 * Orchestration flow:
 * 1. Call queue client to remove
 * 2. Log success or failure
 */
export async function removeTask(
  ctx: Context,
  request: RemoveTaskRequest,
  deps: RemoveTaskDeps,
): Promise<Result<void, AppError>> {
  const { client, logger, queueName } = deps;
  const { taskId } = request;

  const removeResult = await client.remove(ctx, taskId);

  if (removeResult.isErr()) {
    logger.error('Failed to remove task from queue', removeResult.error, {
      correlationId: ctx.correlationId,
      taskId,
      queueName,
    });
    return removeResult;
  }

  logger.info('Task removed from queue', {
    correlationId: ctx.correlationId,
    taskId,
    queueName,
  });

  return ok(undefined);
}
