import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IQueueClient } from '@backend/infrastructure/queue/domain/QueueClient';
import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface GetJobCountsDeps {
  readonly client: IQueueClient;
  readonly logger: ILogger;
  readonly queueName: string;
}

export type GetJobCountsRequest = Record<string, never>;

/**
 * Gets job counts by status from the queue.
 */
export async function getJobCounts(
  ctx: Context,
  _request: GetJobCountsRequest,
  deps: GetJobCountsDeps,
): Promise<Result<QueueStats, AppError>> {
  const { client, logger, queueName } = deps;

  const result = await client.getStats(ctx);

  if (result.isErr()) {
    logger.error('Failed to get job counts', result.error, {
      correlationId: ctx.correlationId,
      queueName,
    });
    return result;
  }

  return result;
}
