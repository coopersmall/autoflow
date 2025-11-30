import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IQueueClient } from '@backend/infrastructure/queue/domain/QueueClient';
import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export interface GetJobCountsContext {
  readonly client: IQueueClient;
  readonly logger: ILogger;
  readonly queueName: string;
}

export interface GetJobCountsRequest {
  readonly correlationId: CorrelationId;
}

/**
 * Gets job counts by status from the queue.
 */
export async function getJobCounts(
  ctx: GetJobCountsContext,
  request: GetJobCountsRequest,
): Promise<Result<QueueStats, ErrorWithMetadata>> {
  const { client, logger, queueName } = ctx;
  const { correlationId } = request;

  const result = await client.getStats(correlationId);

  if (result.isErr()) {
    logger.error('Failed to get job counts', result.error, {
      correlationId,
      queueName,
    });
    return result;
  }

  return result;
}
