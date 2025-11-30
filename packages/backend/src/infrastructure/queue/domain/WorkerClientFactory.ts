import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import type {
  IWorkerClient,
  QueueProvider,
  WorkerJobHandler,
} from './WorkerClient.ts';

/**
 * Type of worker client implementation
 */
export type WorkerClientType = QueueProvider;

/**
 * Interface for worker client factory.
 *
 * This factory:
 * - Validates configuration before creating worker clients
 * - Returns Result types for error handling
 * - Supports multiple queue implementations via type parameter
 * - Provides dependency injection for testing
 * - Hides implementation details from consumers
 */
export interface IWorkerClientFactory {
  /**
   * Create a worker client for processing jobs from a queue
   *
   * @param queueName - Name of the queue to process jobs from
   * @param handler - Job handler function that processes queue jobs
   * @param type - Worker implementation type (defaults to 'bullmq')
   * @returns Result with IWorkerClient or configuration/creation error
   */
  getWorkerClient(
    queueName: string,
    handler: WorkerJobHandler,
    type?: WorkerClientType,
  ): Result<IWorkerClient, ErrorWithMetadata>;
}
