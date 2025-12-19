import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import { type AppError, internalError } from '@core/errors';

import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';

const bulkUpdateSchema = zod.array(
  zod.object({
    count: zod.number().int().nonnegative(),
  }),
);

type BulkUpdateResult = zod.infer<typeof bulkUpdateSchema>;

function validBulkUpdate(data: unknown): Result<BulkUpdateResult, AppError> {
  return validate(bulkUpdateSchema, data);
}

export interface BulkUpdateTasksDeps {
  readonly db: IDatabaseClient;
}

export interface BulkUpdateTasksRequest {
  readonly updates: Array<{ id: TaskId; data: Partial<TaskRecord> }>;
}

/**
 * Bulk update multiple tasks in a single query.
 * Uses PostgreSQL UNNEST to efficiently update multiple rows with different data.
 */
export async function bulkUpdateTasks(
  deps: BulkUpdateTasksDeps,
  request: BulkUpdateTasksRequest,
): Promise<Result<number, AppError>> {
  const { db } = deps;
  const { updates } = request;

  if (updates.length === 0) {
    return ok(0);
  }

  try {
    // Build PostgreSQL array literals manually for UNNEST
    // postgres.js requires arrays to be formatted as PostgreSQL array literals
    const idsArray = `{${updates.map((u) => `"${String(u.id)}"`).join(',')}}`;
    const dataArray = `{${updates.map((u) => `"${JSON.stringify(u.data).replace(/"/g, '\\"')}"`).join(',')}}`;

    // UNNEST creates a virtual table from parallel arrays, allowing us to
    // join each task ID with its corresponding update data in a single query
    const result = await db`
      UPDATE tasks t
      SET 
        data = t.data || u.data_update::jsonb,
        updated_at = NOW()
      FROM (
        SELECT * FROM UNNEST(
          ${idsArray}::text[],
          ${dataArray}::text[]
        ) AS u(id, data_update)
      ) u
      WHERE t.id = u.id
      RETURNING 1 AS count
    `;

    const bulkUpdateResult = validBulkUpdate(result);
    if (bulkUpdateResult.isErr()) {
      return err(
        internalError('Invalid bulk update result', {
          metadata: {
            updateCount: updates.length,
            validationError: bulkUpdateResult.error,
          },
        }),
      );
    }

    const count = bulkUpdateResult.value.length;

    return ok(count);
  } catch (error) {
    return err(
      internalError('Failed to bulk update tasks', {
        cause: error instanceof Error ? error : undefined,
        metadata: { updateCount: updates.length },
      }),
    );
  }
}
