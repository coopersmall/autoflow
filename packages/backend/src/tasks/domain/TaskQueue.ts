import type { QueueJob } from '@backend/infrastructure/queue/domain/QueueClient';
import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import type { TaskId } from './TaskId';
import type { TaskRecord } from './TaskRecord';

/**
 * Interface for task queue operations.
 * Abstracts queue implementation for dependency injection.
 * Uses generic QueueJob instead of BullMQ-specific Job type.
 */
export interface ITaskQueue {
  /**
   * Add a task to the queue
   * @param task - Task record to enqueue
   * @returns Result with generic QueueJob or error
   */
  enqueue(
    correlationId: CorrelationId,
    task: TaskRecord,
  ): Promise<Result<QueueJob, ErrorWithMetadata>>;

  /**
   * Remove a task from the queue by task ID
   * @param taskId - ID of task to remove
   * @returns Result with void or error
   */
  remove(
    correlationId: CorrelationId,
    taskId: TaskId,
  ): Promise<Result<void, ErrorWithMetadata>>;

  /**
   * Get a job by job ID
   * @param jobId - Queue job ID
   * @returns Result with generic QueueJob or null if not found
   */
  getJob(
    correlationId: CorrelationId,
    jobId: string,
  ): Promise<Result<QueueJob | null, ErrorWithMetadata>>;

  /**
   * Get job counts by status
   * @returns Result with queue statistics including queue name
   */
  getJobCounts(
    correlationId: CorrelationId,
  ): Promise<Result<QueueStats, ErrorWithMetadata>>;

  /**
   * Close the queue connection
   */
  close(): Promise<void>;
}
