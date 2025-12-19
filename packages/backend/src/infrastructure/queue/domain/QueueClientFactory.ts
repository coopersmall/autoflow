import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { IQueueClient } from './QueueClient.ts';
import type { QueueProvider } from './WorkerClient.ts';

/**
 * Supported queue client types.
 * Reuses QueueProvider for consistency across queue and worker clients.
 */
export type QueueClientType = QueueProvider;

/**
 * Factory interface for creating queue client instances.
 * Follows the same pattern as DatabaseClientFactory and CacheClientFactory.
 *
 * This factory:
 * - Validates configuration before creating clients
 * - Returns Result types for error handling
 * - Supports multiple queue implementations via type parameter
 * - Provides dependency injection for testing
 * - Hides implementation details from consumers
 *
 * Note: Worker clients are created by IWorkerClientFactory in the worker folder.
 */
export interface IQueueClientFactory {
  /**
   * Create a queue client for enqueueing and managing jobs
   *
   * @param queueName - Name of the queue to connect to
   * @param type - Queue implementation type (defaults to 'bullmq')
   * @returns Result with IQueueClient or configuration/creation error
   */
  getQueueClient(
    queueName: string,
    type?: QueueClientType,
  ): Result<IQueueClient, AppError>;
}
