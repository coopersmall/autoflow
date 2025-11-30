import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { validateRawDatabaseQuery } from '@backend/infrastructure/repos/domain/RawDatabaseQuery';
import { SharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { TaskStatus } from '@backend/tasks/domain/TaskStatus';
import type {
  ITasksRepo,
  ListTasksFilters,
} from '@backend/tasks/domain/TasksRepo';
import { validTaskRecord } from '@backend/tasks/domain/validation/validTaskRecord';
import type { UserId } from '@core/domain/user/user';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ValidationError } from '@core/errors/ValidationError';
import { type Validator, validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';
import zod from 'zod';

export function createTasksRepo({
  appConfig,
}: {
  appConfig: IAppConfigurationService;
}): ITasksRepo {
  return Object.freeze(new TasksRepo(appConfig));
}

class TasksRepo extends SharedRepo<TaskId, TaskRecord> implements ITasksRepo {
  constructor(appConfig: IAppConfigurationService) {
    super('tasks', appConfig, validTaskRecord);
  }

  async getByStatus(
    status: TaskStatus,
    limit = 100,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const db = clientResult.value;

    try {
      const query = db`
        SELECT * FROM tasks
        WHERE (data->>'status') = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return await this.executeQuery(async () => query, validTaskRecord);
    } catch (error) {
      return err(
        new ErrorWithMetadata(
          'Failed to get tasks by status',
          'InternalServer',
          {
            status,
            error: error instanceof Error ? error.message : String(error),
          },
        ),
      );
    }
  }

  async getByTaskName(
    taskName: string,
    limit = 100,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const db = clientResult.value;

    try {
      const query = db`
        SELECT * FROM tasks
        WHERE (data->>'taskName') = ${taskName}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
      return await this.executeQuery(async () => query, validTaskRecord);
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

  async getByUserId(
    userId: UserId,
    limit = 100,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const db = clientResult.value;

    try {
      const query = db`
        SELECT * FROM tasks
        WHERE (data->>'userId') = ${String(userId)}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;

      return await this.executeQuery(async () => query, validTaskRecord);
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

  async listTasks(
    filters?: ListTasksFilters,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const db = clientResult.value;

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

      return await this.executeQuery(async () => query, validTaskRecord);
    } catch (error) {
      return err(
        new ErrorWithMetadata('Failed to list tasks', 'InternalServer', {
          filters,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  /**
   * Bulk update multiple tasks in a single query.
   * Uses PostgreSQL UNNEST to efficiently update multiple rows with different data.
   *
   * @param updates Array of task IDs and their partial data updates
   * @returns Number of rows updated
   */
  async bulkUpdate(
    updates: Array<{ id: TaskId; data: Partial<TaskRecord> }>,
  ): Promise<Result<number, ErrorWithMetadata>> {
    if (updates.length === 0) {
      return ok(0);
    }

    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const db = clientResult.value;

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
          new ErrorWithMetadata(
            'Invalid bulk update result',
            'InternalServer',
            {
              updateCount: updates.length,
              validationError: bulkUpdateResult.error,
            },
          ),
        );
      }

      const count = bulkUpdateResult.value.length;

      return ok(count);
    } catch (error) {
      return err(
        new ErrorWithMetadata('Failed to bulk update tasks', 'InternalServer', {
          updateCount: updates.length,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  private async executeQuery<T>(
    query: () => Promise<unknown>,
    validator: Validator<T>,
  ): Promise<Result<T[], ErrorWithMetadata>> {
    try {
      const results = await query();

      const validationResult = validateRawDatabaseQuery(results);
      if (validationResult.isErr()) {
        return err(validationResult.error);
      }

      const records: T[] = [];
      for (const result of validationResult.value) {
        const recordResult = validator({
          ...result.data,
          id: result.id,
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        });

        if (recordResult.isErr()) {
          return err(recordResult.error);
        }
        records.push(recordResult.value);
      }

      return ok(records);
    } catch (error) {
      return err(
        new ErrorWithMetadata('Failed to execute query', 'InternalServer', {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}

const bulkUpdateSchema = zod.array(
  zod.object({
    count: zod.number().int().nonnegative(),
  }),
);

type BulkUpdateResult = zod.infer<typeof bulkUpdateSchema>;

function validBulkUpdate(
  data: unknown,
): Result<BulkUpdateResult, ValidationError> {
  return validate(bulkUpdateSchema, data);
}
