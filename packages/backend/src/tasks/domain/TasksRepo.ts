import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { TaskStatus } from '@backend/tasks/domain/TaskStatus';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

/**
 * Filter options for listing tasks
 */
export interface ListTasksFilters {
  status?: TaskStatus;
  taskName?: string;
  userId?: UserId;
  limit?: number;
  offset?: number;
}

/**
 * Repository interface for task audit records.
 * Extends SharedRepo with task-specific query methods.
 */
export interface ITasksRepo extends ISharedRepo<TaskId, TaskRecord> {
  /**
   * Get tasks by status
   */
  getByStatus(
    status: TaskStatus,
    limit?: number,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;

  /**
   * Get tasks by task name
   */
  getByTaskName(
    taskName: string,
    limit?: number,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;

  /**
   * Get tasks by user ID
   */
  getByUserId(
    userId: string,
    limit?: number,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;

  /**
   * List tasks with optional filtering and pagination
   */
  listTasks(
    filters?: ListTasksFilters,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;

  /**
   * Bulk update multiple tasks in a single query.
   * Uses PostgreSQL UNNEST for efficient batch updates with different data per row.
   *
   * @param updates Array of task IDs and their partial data updates
   * @returns Number of rows updated
   */
  bulkUpdate(
    updates: Array<{ id: TaskId; data: Partial<TaskRecord> }>,
  ): Promise<Result<number, ErrorWithMetadata>>;
}
