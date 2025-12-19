import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { SharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { TaskStatus } from '@backend/tasks/domain/TaskStatus';
import type {
  ITasksRepo,
  ListTasksFilters,
} from '@backend/tasks/domain/TasksRepo';
import { validTaskRecord } from '@backend/tasks/domain/validation/validTaskRecord';
import {
  bulkUpdateTasks,
  executeTaskQuery,
  getTasksByStatus,
  getTasksByTaskName,
  getTasksByUserId,
  listTasks,
} from '@backend/tasks/repos/actions';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Validator } from '@core/validation/validate';
import { err, type Result } from 'neverthrow';

interface TasksRepoActions {
  getTasksByStatus: typeof getTasksByStatus;
  getTasksByTaskName: typeof getTasksByTaskName;
  getTasksByUserId: typeof getTasksByUserId;
  listTasks: typeof listTasks;
  bulkUpdateTasks: typeof bulkUpdateTasks;
  executeTaskQuery: typeof executeTaskQuery;
}

export function createTasksRepo({
  appConfig,
}: {
  appConfig: IAppConfigurationService;
}): ITasksRepo {
  return Object.freeze(new TasksRepo(appConfig));
}

class TasksRepo extends SharedRepo<TaskId, TaskRecord> implements ITasksRepo {
  constructor(
    appConfig: IAppConfigurationService,
    private readonly tasksRepoActions: TasksRepoActions = {
      getTasksByStatus,
      getTasksByTaskName,
      getTasksByUserId,
      listTasks,
      bulkUpdateTasks,
      executeTaskQuery,
    },
  ) {
    super('tasks', appConfig, validTaskRecord);
  }

  async getByStatus(
    status: TaskStatus,
    limit = 100,
  ): Promise<Result<TaskRecord[], AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    return this.tasksRepoActions.getTasksByStatus(
      {
        db: clientResult.value,
        validator: validTaskRecord,
        executeQuery: this.executeQuery.bind(this),
      },
      { status, limit },
    );
  }

  async getByTaskName(
    taskName: string,
    limit = 100,
  ): Promise<Result<TaskRecord[], AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    return this.tasksRepoActions.getTasksByTaskName(
      {
        db: clientResult.value,
        validator: validTaskRecord,
        executeQuery: this.executeQuery.bind(this),
      },
      { taskName, limit },
    );
  }

  async getByUserId(
    userId: UserId,
    limit = 100,
  ): Promise<Result<TaskRecord[], AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    return this.tasksRepoActions.getTasksByUserId(
      {
        db: clientResult.value,
        validator: validTaskRecord,
        executeQuery: this.executeQuery.bind(this),
      },
      { userId, limit },
    );
  }

  async listTasks(
    filters?: ListTasksFilters,
  ): Promise<Result<TaskRecord[], AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    return this.tasksRepoActions.listTasks(
      {
        db: clientResult.value,
        validator: validTaskRecord,
        executeQuery: this.executeQuery.bind(this),
      },
      { filters },
    );
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
  ): Promise<Result<number, AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    return this.tasksRepoActions.bulkUpdateTasks(
      {
        db: clientResult.value,
      },
      { updates },
    );
  }

  private async executeQuery<T>(
    query: () => Promise<unknown>,
    validator: Validator<T>,
  ): Promise<Result<T[], AppError>> {
    return this.tasksRepoActions.executeTaskQuery({}, { query, validator });
  }
}
