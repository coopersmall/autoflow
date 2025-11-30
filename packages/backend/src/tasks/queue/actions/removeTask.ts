import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IQueueClient } from '@backend/infrastructure/queue/domain/QueueClient';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { ok, type Result } from 'neverthrow';

export interface RemoveTaskContext {
  readonly client: IQueueClient;
  readonly logger: ILogger;
  readonly queueName: string;
}

export interface RemoveTaskRequest {
  readonly correlationId: CorrelationId;
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
  ctx: RemoveTaskContext,
  request: RemoveTaskRequest,
): Promise<Result<void, ErrorWithMetadata>> {
  const { client, logger, queueName } = ctx;
  const { correlationId, taskId } = request;

  const removeResult = await client.remove(correlationId, taskId);

  if (removeResult.isErr()) {
    logger.error('Failed to remove task from queue', removeResult.error, {
      correlationId,
      taskId,
      queueName,
    });
    return removeResult;
  }

  logger.info('Task removed from queue', {
    correlationId,
    taskId,
    queueName,
  });

  return ok(undefined);
}
