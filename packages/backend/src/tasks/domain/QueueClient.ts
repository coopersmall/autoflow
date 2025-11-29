import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import type { QueueStats } from './QueueStats';
import type { TaskId } from './TaskId';
import type { TaskRecord } from './TaskRecord';

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
   * Add a task to the queue
   * @param correlationId - Request correlation ID for tracing
   * @param task - Task record to enqueue
   * @returns Result with generic QueueJob or error
   */
  enqueue(
    correlationId: CorrelationId,
    task: TaskRecord,
  ): Promise<Result<QueueJob, ErrorWithMetadata>>;

  /**
   * Remove a task from the queue by task ID
   * @param correlationId - Request correlation ID for tracing
   * @param taskId - ID of task to remove
   * @returns Result with void or error
   */
  remove(
    correlationId: CorrelationId,
    taskId: TaskId,
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
