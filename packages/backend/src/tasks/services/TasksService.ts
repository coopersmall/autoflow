import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import { SharedService } from '@backend/infrastructure/services/SharedService';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import { TaskId as TaskIdConstructor } from '@backend/tasks/domain/TaskId';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { TaskStatus } from '@backend/tasks/domain/TaskStatus';
import type {
  ITasksRepo,
  ListTasksFilters,
} from '@backend/tasks/domain/TasksRepo';
import type { ITasksService } from '@backend/tasks/domain/TasksService';
import { createTaskQueue } from '@backend/tasks/queue/TaskQueue';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import { cancelTask } from '@backend/tasks/services/actions/operations/cancelTask';
import { retryTask } from '@backend/tasks/services/actions/operations/retryTask';
import { getQueueStats } from '@backend/tasks/services/actions/queries/getQueueStats';
import { getTasksByStatus } from '@backend/tasks/services/actions/queries/getTasksByStatus';
import { getTasksByTaskName } from '@backend/tasks/services/actions/queries/getTasksByTaskName';
import { getTasksByUserId } from '@backend/tasks/services/actions/queries/getTasksByUserId';
import { listTasks } from '@backend/tasks/services/actions/queries/listTasks';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export { createTasksService };

function createTasksService(config: TasksServiceConfig): ITasksService {
  return Object.freeze(new TasksService(config));
}

interface TasksServiceConfig {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}

interface TasksServiceActions {
  getTasksByStatus: typeof getTasksByStatus;
  getTasksByTaskName: typeof getTasksByTaskName;
  getTasksByUserId: typeof getTasksByUserId;
  listTasks: typeof listTasks;
  getQueueStats: typeof getQueueStats;
  cancelTask: typeof cancelTask;
  retryTask: typeof retryTask;
}

interface TasksServiceDependencies {
  createTasksRepo: typeof createTasksRepo;
  createTaskQueue: typeof createTaskQueue;
}

class TasksService
  extends SharedService<TaskId, TaskRecord>
  implements ITasksService
{
  private readonly taskQueue: (queueName: string) => ITaskQueue;

  constructor(
    private readonly tasksConfig: TasksServiceConfig,
    private readonly actions: TasksServiceActions = {
      getTasksByStatus,
      getTasksByTaskName,
      getTasksByUserId,
      listTasks,
      getQueueStats,
      cancelTask,
      retryTask,
    },
    private readonly dependencies: TasksServiceDependencies = {
      createTasksRepo,
      createTaskQueue,
    },
  ) {
    const appConfig = tasksConfig.appConfig;
    super('tasks', {
      ...tasksConfig,
      repo: () => this.dependencies.createTasksRepo({ appConfig }),
      newId: TaskIdConstructor,
    });
    this.taskQueue = (queueName: string) =>
      this.dependencies.createTaskQueue({
        queueName,
        logger: tasksConfig.logger,
        appConfig,
      });
  }

  private get tasksRepo(): ITasksRepo {
    return this.dependencies.createTasksRepo({
      appConfig: this.tasksConfig.appConfig,
    });
  }

  async getByStatus(
    status: TaskStatus,
  ): Promise<Result<TaskRecord[], AppError>> {
    return this.actions.getTasksByStatus(
      { tasksRepo: this.tasksRepo },
      { status },
    );
  }

  async getByTaskName(
    taskName: string,
  ): Promise<Result<TaskRecord[], AppError>> {
    return this.actions.getTasksByTaskName(
      { tasksRepo: this.tasksRepo },
      { taskName },
    );
  }

  async getByUserId(userId: UserId): Promise<Result<TaskRecord[], AppError>> {
    return this.actions.getTasksByUserId(
      { tasksRepo: this.tasksRepo },
      { userId },
    );
  }

  async listTasks(
    filters?: ListTasksFilters,
  ): Promise<Result<TaskRecord[], AppError>> {
    return this.actions.listTasks({ tasksRepo: this.tasksRepo }, { filters });
  }

  async getQueueStats(
    ctx: Context,
    queueName: string,
  ): Promise<Result<QueueStats, AppError>> {
    return this.actions.getQueueStats(
      ctx,
      {
        queueName,
      },
      {
        taskQueue: this.taskQueue,
      },
    );
  }

  async retryTask(
    ctx: Context,
    taskId: TaskId,
  ): Promise<Result<TaskRecord, AppError>> {
    return this.actions.retryTask(
      ctx,
      { taskId },
      {
        tasksRepo: this.tasksRepo,
        taskQueue: this.taskQueue,
        logger: this.tasksConfig.logger,
      },
    );
  }

  async cancelTask(
    ctx: Context,
    taskId: TaskId,
  ): Promise<Result<TaskRecord, AppError>> {
    return this.actions.cancelTask(
      ctx,
      { taskId },
      {
        tasksRepo: this.tasksRepo,
        taskQueue: this.taskQueue,
        logger: this.tasksConfig.logger,
      },
    );
  }
}
