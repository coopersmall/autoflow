import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { type AppError, internalError } from '@core/errors';
import { unreachable } from '@core/unreachable';
import { err, ok, type Result } from 'neverthrow';
import type { IQueueClient } from '../domain/QueueClient';
import type {
  IQueueClientFactory,
  QueueClientType,
} from '../domain/QueueClientFactory';
import { DEFAULT_QUEUE_CONFIG, type QueueConfig } from '../domain/QueueConfig';
import { createBullMQQueueClient } from './bullmq/BullMQQueueClient';

/**
 * Dependencies for QueueClientFactory (for testing)
 */
interface QueueClientFactoryDependencies {
  createBullMQQueueClient: typeof createBullMQQueueClient;
}

/**
 * Factory function to create a QueueClientFactory instance
 *
 * @param appConfig - Application configuration service
 * @param queueConfig - Optional queue configuration (defaults to DEFAULT_QUEUE_CONFIG).
 *                      Use FAST_RETRY_CONFIG for integration tests.
 * @param dependencies - Optional dependencies for testing
 */
export function createQueueClientFactory(
  {
    appConfig,
    queueConfig,
  }: {
    appConfig: IAppConfigurationService;
    queueConfig?: QueueConfig;
  },
  dependencies?: QueueClientFactoryDependencies,
): IQueueClientFactory {
  return Object.freeze(
    new QueueClientFactory(appConfig, queueConfig, dependencies),
  );
}

/**
 * Factory for creating queue client instances.
 * Follows the same pattern as DatabaseClientFactory and CacheClientFactory.
 *
 * Responsibilities:
 * - Validates configuration before creating clients
 * - Returns Result types for error handling
 * - Supports multiple queue implementations (BullMQ, AWS SQS, RabbitMQ)
 * - Provides dependency injection for testing
 * - Hides implementation details from consumers
 *
 * Note: Worker clients are created by WorkerClientFactory in the worker folder.
 */
class QueueClientFactory implements IQueueClientFactory {
  constructor(
    private readonly appConfig: IAppConfigurationService,
    private readonly queueConfig: QueueConfig = DEFAULT_QUEUE_CONFIG,
    private readonly dependencies = { createBullMQQueueClient },
  ) {}

  /**
   * Create a queue client for enqueueing and managing jobs
   */
  getQueueClient(
    queueName: string,
    type: QueueClientType = 'bullmq',
  ): Result<IQueueClient, AppError> {
    switch (type) {
      case 'bullmq':
        return this.getBullMQQueueClient(queueName);
      case 'sqs':
      case 'rabbitmq':
        return err(
          internalError(`Queue provider '${type}' is not yet implemented`, {
            metadata: { queueName, provider: type },
          }),
        );
      default:
        return unreachable(type);
    }
  }

  /**
   * Create a BullMQ queue client
   */
  private getBullMQQueueClient(
    queueName: string,
  ): Result<IQueueClient, AppError> {
    const redisUrl = this.appConfig.redisUrl;

    if (!redisUrl) {
      return err(
        internalError('Redis URL not configured', {
          metadata: {
            configKey: 'redisUrl',
            queueName,
          },
        }),
      );
    }

    try {
      const client = this.dependencies.createBullMQQueueClient({
        queueName,
        redisUrl,
        config: this.queueConfig,
      });

      return ok(client);
    } catch (error) {
      return err(
        internalError('Failed to create BullMQ queue client', {
          cause: error instanceof Error ? error : undefined,
          metadata: {
            queueName,
            redisUrl,
          },
        }),
      );
    }
  }
}
