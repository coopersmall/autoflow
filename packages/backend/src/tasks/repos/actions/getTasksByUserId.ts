import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { UserId } from '@core/domain/user/user';
import { type AppError, internalError } from '@core/errors';
import type { Validator } from '@core/validation/validate';
import { err, type Result } from 'neverthrow';

export interface GetTasksByUserIdDeps {
  readonly db: IDatabaseClient;
  readonly validator: Validator<TaskRecord>;
  readonly executeQuery: (
    query: () => Promise<unknown>,
    validator: Validator<TaskRecord>,
  ) => Promise<Result<TaskRecord[], AppError>>;
}

export interface GetTasksByUserIdRequest {
  readonly userId: UserId;
  readonly limit?: number;
}

/**
 * Get tasks by user ID with optional limit.
 */
export async function getTasksByUserId(
  deps: GetTasksByUserIdDeps,
  request: GetTasksByUserIdRequest,
): Promise<Result<TaskRecord[], AppError>> {
  const { db, validator, executeQuery } = deps;
  const { userId, limit = 100 } = request;

  try {
    const query = db`
      SELECT * FROM tasks
      WHERE (data->>'userId') = ${String(userId)}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return await executeQuery(async () => query, validator);
  } catch (error) {
    return err(
      internalError('Failed to get tasks by user ID', {
        cause: error,
        metadata: { userId },
      }),
    );
  }
}
