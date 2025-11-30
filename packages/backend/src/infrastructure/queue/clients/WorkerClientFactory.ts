import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { unreachable } from '@core/unreachable';
import { err, ok, type Result } from 'neverthrow';
import type { IWorkerClient, WorkerJobHandler } from '../domain/WorkerClient';
import type {
  IWorkerClientFactory,
  WorkerClientType,
} from '../domain/WorkerClientFactory';
import { createBullMQWorkerClient } from './bullmq/BullMQWorkerClient';

/**
 * Dependencies for WorkerClientFactory (for testing)
 */
interface WorkerClientFactoryDependencies {
  createBullMQWorkerClient: typeof createBullMQWorkerClient;
}

/**
 * Factory function to create a WorkerClientFactory instance
 *
 * @param appConfig - Application configuration service
 * @param dependencies - Optional dependencies for testing
 */
export function createWorkerClientFactory(
  {
    appConfig,
  }: {
    appConfig: IAppConfigurationService;
  },
  dependencies?: WorkerClientFactoryDependencies,
): IWorkerClientFactory {
  return Object.freeze(new WorkerClientFactory(appConfig, dependencies));
}

/**
 * Factory for creating worker client instances.
 *
 * Responsibilities:
 * - Validates configuration before creating clients
 * - Returns Result types for error handling
 * - Supports multiple queue implementations (BullMQ, AWS SQS, RabbitMQ)
 * - Provides dependency injection for testing
 * - Hides implementation details from consumers
 */
class WorkerClientFactory implements IWorkerClientFactory {
  constructor(
    private readonly appConfig: IAppConfigurationService,
    private readonly dependencies = { createBullMQWorkerClient },
  ) {}

  /**
   * Create a worker client for processing jobs
   */
  getWorkerClient(
    queueName: string,
    handler: WorkerJobHandler,
    type: WorkerClientType = 'bullmq',
  ): Result<IWorkerClient, ErrorWithMetadata> {
    switch (type) {
      case 'bullmq':
        return this.getBullMQWorkerClient(queueName, handler);
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
   * Create a BullMQ worker client
   */
  private getBullMQWorkerClient(
    queueName: string,
    handler: WorkerJobHandler,
  ): Result<IWorkerClient, ErrorWithMetadata> {
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
      const client = this.dependencies.createBullMQWorkerClient({
        queueName,
        redisUrl,
        handler,
      });

      return ok(client);
    } catch (error) {
      return err(
        new ErrorWithMetadata(
          'Failed to create BullMQ worker client',
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
