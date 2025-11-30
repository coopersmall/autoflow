import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Validator } from '@core/validation/validate';
import { err, type Result } from 'neverthrow';

export interface GetTasksByTaskNameContext {
  readonly db: IDatabaseClient;
  readonly validator: Validator<TaskRecord>;
  readonly executeQuery: (
    query: () => Promise<unknown>,
    validator: Validator<TaskRecord>,
  ) => Promise<Result<TaskRecord[], ErrorWithMetadata>>;
}

export interface GetTasksByTaskNameRequest {
  readonly taskName: string;
  readonly limit?: number;
}

/**
 * Get tasks by task name with optional limit.
 */
export async function getTasksByTaskName(
  ctx: GetTasksByTaskNameContext,
  request: GetTasksByTaskNameRequest,
): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
  const { db, validator, executeQuery } = ctx;
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
      new ErrorWithMetadata(
        'Failed to get tasks by task name',
        'InternalServer',
        {
          taskName,
          error: error instanceof Error ? error.message : String(error),
        },
      ),
    );
  }
}
