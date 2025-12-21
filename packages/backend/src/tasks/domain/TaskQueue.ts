import type { Context } from '@backend/infrastructure/context';
import type { QueueJob } from '@backend/infrastructure/queue/domain/QueueClient';
import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import type { AppError } from '@core/errors/AppError';
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
   * @param ctx - Request context
   * @param task - Task record to enqueue
   * @returns Result with generic QueueJob or error
   */
  enqueue(ctx: Context, task: TaskRecord): Promise<Result<QueueJob, AppError>>;

  /**
   * Remove a task from the queue by task ID
   * @param ctx - Request context
   * @param taskId - ID of task to remove
   * @returns Result with void or error
   */
  remove(ctx: Context, taskId: TaskId): Promise<Result<void, AppError>>;

  /**
   * Get a job by job ID
   * @param ctx - Request context
   * @param jobId - Queue job ID
   * @returns Result with generic QueueJob or null if not found
   */
  getJob(
    ctx: Context,
    jobId: string,
  ): Promise<Result<QueueJob | null, AppError>>;

  /**
   * Get job counts by status
   * @param ctx - Request context
   * @returns Result with queue statistics including queue name
   */
  getJobCounts(ctx: Context): Promise<Result<QueueStats, AppError>>;

  /**
   * Close the queue connection
   */
  close(): Promise<void>;
}
