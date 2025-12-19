import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { TaskStatus } from '@backend/tasks/domain/TaskStatus';
import { type AppError, internalError } from '@core/errors';
import type { Validator } from '@core/validation/validate';
import { err, type Result } from 'neverthrow';

export interface GetTasksByStatusDeps {
  readonly db: IDatabaseClient;
  readonly validator: Validator<TaskRecord>;
  readonly executeQuery: (
    query: () => Promise<unknown>,
    validator: Validator<TaskRecord>,
  ) => Promise<Result<TaskRecord[], AppError>>;
}

export interface GetTasksByStatusRequest {
  readonly status: TaskStatus;
  readonly limit?: number;
}

/**
 * Get tasks by status with optional limit.
 */
export async function getTasksByStatus(
  deps: GetTasksByStatusDeps,
  request: GetTasksByStatusRequest,
): Promise<Result<TaskRecord[], AppError>> {
  const { db, validator, executeQuery } = deps;
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
      internalError('Failed to get tasks by status', {
        cause: error instanceof Error ? error : undefined,
        metadata: { status },
      }),
    );
  }
}
