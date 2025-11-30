import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { TaskStatus } from '@backend/tasks/domain/TaskStatus';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Validator } from '@core/validation/validate';
import { err, type Result } from 'neverthrow';

export interface GetTasksByStatusContext {
  readonly db: IDatabaseClient;
  readonly validator: Validator<TaskRecord>;
  readonly executeQuery: (
    query: () => Promise<unknown>,
    validator: Validator<TaskRecord>,
  ) => Promise<Result<TaskRecord[], ErrorWithMetadata>>;
}

export interface GetTasksByStatusRequest {
  readonly status: TaskStatus;
  readonly limit?: number;
}

/**
 * Get tasks by status with optional limit.
 */
export async function getTasksByStatus(
  ctx: GetTasksByStatusContext,
  request: GetTasksByStatusRequest,
): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
  const { db, validator, executeQuery } = ctx;
  const { status, limit = 100 } = request;

  try {
    const query = db`
      SELECT * FROM tasks
      WHERE (data->>'status') = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return await executeQuery(async () => query, validator);
  } catch (error) {
    return err(
      new ErrorWithMetadata('Failed to get tasks by status', 'InternalServer', {
        status,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
