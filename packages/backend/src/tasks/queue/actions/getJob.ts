import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type {
  IQueueClient,
  QueueJob,
} from '@backend/infrastructure/queue/domain/QueueClient';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface GetJobDeps {
  readonly client: IQueueClient;
  readonly logger: ILogger;
  readonly queueName: string;
}

export interface GetJobRequest {
  readonly jobId: string;
}

/**
 * Gets a job by job ID from the queue.
 * Returns generic QueueJob instead of queue-specific Job type.
 */
export async function getJob(
  ctx: Context,
  request: GetJobRequest,
  deps: GetJobDeps,
): Promise<Result<QueueJob | null, AppError>> {
  const { client, logger, queueName } = deps;
  const { jobId } = request;

  const result = await client.getJob(ctx, jobId);

  if (result.isErr()) {
    logger.error('Failed to get job', result.error, {
      correlationId: ctx.correlationId,
      jobId,
      queueName,
    });
    return result;
  }

  return result;
}
