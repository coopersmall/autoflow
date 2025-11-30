import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IQueueClient } from '@backend/infrastructure/queue/domain/QueueClient';

export interface CloseQueueContext {
  readonly client: IQueueClient;
  readonly logger: ILogger;
  readonly queueName: string;
}

/**
 * Closes the queue connection.
 */
export async function closeQueue(ctx: CloseQueueContext): Promise<void> {
  const { client, logger, queueName } = ctx;

  await client.close();
  logger.info('TaskQueue closed', { queueName });
}
