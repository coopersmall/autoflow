import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import type { QueueStats } from './QueueStats.ts';

/**
 * Generic job representation (decoupled from BullMQ)
 * This allows us to swap queue implementations without changing consumers
 */
export interface QueueJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  attemptsMade?: number;
  timestamp?: number;
}

/**
 * Input data for enqueueing a job to the queue.
 * This is a generic representation independent of any specific queue provider.
 */
export interface QueueJobInput {
  /** Unique job identifier */
  id: string;
  /** Job name/type */
  name: string;
  /** Job payload data */
  data: Record<string, unknown>;
  /** Job priority (lower number = higher priority) */
  priority?: 'critical' | 'high' | 'normal' | 'low';
  /** Delay in milliseconds before job becomes available */
  delay?: number;
  /** Maximum number of retry attempts */
  maxAttempts?: number;
}

/**
 * Interface for queue operations.
 * Abstracts the underlying queue implementation (BullMQ, AWS SQS, RabbitMQ, etc.)
 *
 * This interface provides a clean abstraction that:
 * - Hides implementation details of the queue system
 * - Uses generic types instead of vendor-specific types
 * - Returns Result types for error handling
 * - Supports dependency injection and testing
 */
export interface IQueueClient {
  /**
   * Add a job to the queue
   * @param correlationId - Request correlation ID for tracing
   * @param job - Job input data to enqueue
   * @returns Result with generic QueueJob or error
   */
  enqueue(
    correlationId: CorrelationId,
    job: QueueJobInput,
  ): Promise<Result<QueueJob, ErrorWithMetadata>>;

  /**
   * Remove a job from the queue by job ID
   * @param correlationId - Request correlation ID for tracing
   * @param jobId - ID of job to remove
   * @returns Result with void or error
   */
  remove(
    correlationId: CorrelationId,
    jobId: string,
  ): Promise<Result<void, ErrorWithMetadata>>;

  /**
   * Get a job by ID
   * @param correlationId - Request correlation ID for tracing
   * @param jobId - Queue job ID
   * @returns Result with QueueJob or null if not found
   */
  getJob(
    correlationId: CorrelationId,
    jobId: string,
  ): Promise<Result<QueueJob | null, ErrorWithMetadata>>;

  /**
   * Get queue statistics (job counts by status)
   * @param correlationId - Request correlation ID for tracing
   * @returns Result with queue statistics
   */
  getStats(
    correlationId: CorrelationId,
  ): Promise<Result<QueueStats, ErrorWithMetadata>>;

  /**
   * Close the queue connection
   */
  close(): Promise<void>;
}
