import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IQueueClient } from '@backend/tasks/domain/QueueClient';
import type {
  IQueueClientFactory,
  QueueClientType,
} from '@backend/tasks/domain/QueueClientFactory';
import {
  DEFAULT_TASK_QUEUE_CONFIG,
  type TaskQueueConfig,
} from '@backend/tasks/domain/TaskQueueConfig';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { unreachable } from '@core/unreachable';
import { err, ok, type Result } from 'neverthrow';
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
 * @param queueConfig - Optional queue configuration (defaults to DEFAULT_TASK_QUEUE_CONFIG).
 *                      Use FAST_RETRY_QUEUE_CONFIG for integration tests.
 * @param dependencies - Optional dependencies for testing
 */
export function createQueueClientFactory(
  {
    appConfig,
    queueConfig,
  }: {
    appConfig: IAppConfigurationService;
    queueConfig?: TaskQueueConfig;
  },
  dependencies?: QueueClientFactoryDependencies,
): IQueueClientFactory {
  return new QueueClientFactory(appConfig, queueConfig, dependencies);
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
    private readonly queueConfig: TaskQueueConfig = DEFAULT_TASK_QUEUE_CONFIG,
    private readonly dependencies = { createBullMQQueueClient },
  ) {}

  /**
   * Create a queue client for enqueueing and managing jobs
   */
  getQueueClient(
    queueName: string,
    type: QueueClientType = 'bullmq',
  ): Result<IQueueClient, ErrorWithMetadata> {
    switch (type) {
      case 'bullmq':
        return this.getBullMQQueueClient(queueName);
      case 'sqs':
      case 'rabbitmq':
        return err(
          new ErrorWithMetadata(
            `Queue provider '${type}' is not yet implemented`,
            'InternalServer',
            { queueName, provider: type },
          ),
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
  ): Result<IQueueClient, ErrorWithMetadata> {
    const redisUrl = this.appConfig.redisUrl;

    if (!redisUrl) {
      return err(
        new ErrorWithMetadata('Redis URL not configured', 'InternalServer', {
          configKey: 'redisUrl',
          queueName,
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
        new ErrorWithMetadata(
          'Failed to create BullMQ queue client',
          'InternalServer',
          {
            queueName,
            redisUrl,
            cause: error,
          },
        ),
      );
    }
  }
}
