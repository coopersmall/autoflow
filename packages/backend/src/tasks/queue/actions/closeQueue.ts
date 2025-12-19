import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IQueueClient } from '@backend/infrastructure/queue/domain/QueueClient';

export interface CloseQueueDeps {
  readonly client: IQueueClient;
  readonly logger: ILogger;
  readonly queueName: string;
}

/**
 * Closes the queue connection.
 */
export async function closeQueue(deps: CloseQueueDeps): Promise<void> {
  const { client, logger, queueName } = deps;

  await client.close();
  logger.info('TaskQueue closed', { queueName });
}
