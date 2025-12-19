import type { Context } from '@backend/infrastructure/context';
import type { AppError } from '@core/errors/AppError';
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
   * @param ctx - Request context for tracing and cancellation
   * @param job - Job input data to enqueue
   * @returns Result with generic QueueJob or error
   */
  enqueue(
    ctx: Context,
    job: QueueJobInput,
  ): Promise<Result<QueueJob, AppError>>;

  /**
   * Remove a job from the queue by job ID
   * @param ctx - Request context for tracing and cancellation
   * @param jobId - ID of job to remove
   * @returns Result with void or error
   */
  remove(ctx: Context, jobId: string): Promise<Result<void, AppError>>;

  /**
   * Get a job by ID
   * @param ctx - Request context for tracing and cancellation
   * @param jobId - Queue job ID
   * @returns Result with QueueJob or null if not found
   */
  getJob(
    ctx: Context,
    jobId: string,
  ): Promise<Result<QueueJob | null, AppError>>;

  /**
   * Get queue statistics (job counts by status)
   * @param ctx - Request context for tracing and cancellation
   * @returns Result with queue statistics
   */
  getStats(ctx: Context): Promise<Result<QueueStats, AppError>>;

  /**
   * Close the queue connection
   */
  close(): Promise<void>;
}
