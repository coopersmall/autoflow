import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { UserId } from '@core/domain/user/user';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Validator } from '@core/validation/validate';
import { err, type Result } from 'neverthrow';

export interface GetTasksByUserIdContext {
  readonly db: IDatabaseClient;
  readonly validator: Validator<TaskRecord>;
  readonly executeQuery: (
    query: () => Promise<unknown>,
    validator: Validator<TaskRecord>,
  ) => Promise<Result<TaskRecord[], ErrorWithMetadata>>;
}

export interface GetTasksByUserIdRequest {
  readonly userId: UserId;
  readonly limit?: number;
}

/**
 * Get tasks by user ID with optional limit.
 */
export async function getTasksByUserId(
  ctx: GetTasksByUserIdContext,
  request: GetTasksByUserIdRequest,
): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
  const { db, validator, executeQuery } = ctx;
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
      new ErrorWithMetadata(
        'Failed to get tasks by user ID',
        'InternalServer',
        {
          userId,
          error: error instanceof Error ? error.message : String(error),
        },
      ),
    );
  }
}
