import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { type AppError, internalError } from '@core/errors';
import { unreachable } from '@core/unreachable';
import { err, ok, type Result } from 'neverthrow';
import type {
  IWorkerClient,
  WorkerJobHandler,
} from '../domain/WorkerClient.ts';
import type {
  IWorkerClientFactory,
  WorkerClientType,
} from '../domain/WorkerClientFactory.ts';
import { createBullMQWorkerClient } from './bullmq/BullMQWorkerClient.ts';

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
  ): Result<IWorkerClient, AppError> {
    switch (type) {
      case 'bullmq':
        return this.getBullMQWorkerClient(queueName, handler);
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
   * Create a BullMQ worker client
   */
  private getBullMQWorkerClient(
    queueName: string,
    handler: WorkerJobHandler,
  ): Result<IWorkerClient, AppError> {
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
      const client = this.dependencies.createBullMQWorkerClient({
        queueName,
        redisUrl,
        handler,
      });

      return ok(client);
    } catch (error) {
      return err(
        internalError('Failed to create BullMQ worker client', {
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
