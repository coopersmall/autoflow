import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type {
  IQueueClient,
  QueueJob,
} from '@backend/infrastructure/queue/domain/QueueClient';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export interface GetJobContext {
  readonly client: IQueueClient;
  readonly logger: ILogger;
  readonly queueName: string;
}

export interface GetJobRequest {
  readonly correlationId: CorrelationId;
  readonly jobId: string;
}

/**
 * Gets a job by job ID from the queue.
 * Returns generic QueueJob instead of queue-specific Job type.
 */
export async function getJob(
  ctx: GetJobContext,
  request: GetJobRequest,
): Promise<Result<QueueJob | null, ErrorWithMetadata>> {
  const { client, logger, queueName } = ctx;
  const { correlationId, jobId } = request;

  const result = await client.getJob(correlationId, jobId);

  if (result.isErr()) {
    logger.error('Failed to get job', result.error, {
      correlationId,
      jobId,
      queueName,
    });
    return result;
  }

  return result;
}
