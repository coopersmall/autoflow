import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ListTasksFilters } from '@backend/tasks/domain/TasksRepo';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Validator } from '@core/validation/validate';
import { err, type Result } from 'neverthrow';

export interface ListTasksContext {
  readonly db: IDatabaseClient;
  readonly validator: Validator<TaskRecord>;
  readonly executeQuery: (
    query: () => Promise<unknown>,
    validator: Validator<TaskRecord>,
  ) => Promise<Result<TaskRecord[], ErrorWithMetadata>>;
}

export interface ListTasksRequest {
  readonly filters?: ListTasksFilters;
}

/**
 * List tasks with optional filters and pagination.
 */
export async function listTasks(
  ctx: ListTasksContext,
  request: ListTasksRequest,
): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
  const { db, validator, executeQuery } = ctx;
  const { filters } = request;

  try {
    // Start with base query (WHERE 1=1 allows easy AND chaining)
    let query = db`SELECT * FROM tasks WHERE 1=1`;

    // Progressively add filters
    if (filters?.status) {
      query = db`${query} AND (data->>'status') = ${filters.status}`;
    }

    if (filters?.taskName) {
      query = db`${query} AND (data->>'taskName') = ${filters.taskName}`;
    }

    if (filters?.userId) {
      query = db`${query} AND (data->>'userId') = ${filters.userId}`;
    }

    // Add ordering
    query = db`${query} ORDER BY created_at DESC`;

    // Add pagination
    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;

    query = db`${query} LIMIT ${limit} OFFSET ${offset}`;

    return await executeQuery(async () => query, validator);
  } catch (error) {
    return err(
      new ErrorWithMetadata('Failed to list tasks', 'InternalServer', {
        filters,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
