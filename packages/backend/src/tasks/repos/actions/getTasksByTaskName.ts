import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import { type AppError, internalError } from '@core/errors';
import type { Validator } from '@core/validation/validate';
import { err, type Result } from 'neverthrow';

export interface GetTasksByTaskNameDeps {
  readonly db: IDatabaseClient;
  readonly validator: Validator<TaskRecord>;
  readonly executeQuery: (
    query: () => Promise<unknown>,
    validator: Validator<TaskRecord>,
  ) => Promise<Result<TaskRecord[], AppError>>;
}

export interface GetTasksByTaskNameRequest {
  readonly taskName: string;
  readonly limit?: number;
}

/**
 * Get tasks by task name with optional limit.
 */
export async function getTasksByTaskName(
  deps: GetTasksByTaskNameDeps,
  request: GetTasksByTaskNameRequest,
): Promise<Result<TaskRecord[], AppError>> {
  const { db, validator, executeQuery } = deps;
  const { taskName, limit = 100 } = request;

  try {
    const query = db`
      SELECT * FROM tasks
      WHERE (data->>'taskName') = ${taskName}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return await executeQuery(async () => query, validator);
  } catch (error) {
    return err(
      internalError('Failed to get tasks by task name', {
        cause: error,
        metadata: { taskName },
      }),
    );
  }
}
