import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import { SharedService } from '@backend/services/shared/SharedService';
import type { QueueStats } from '@backend/tasks/domain/QueueStats';
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
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export { createTasksService };

function createTasksService(ctx: TasksServiceContext): ITasksService {
  return new TasksService(ctx);
}

interface TasksServiceContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}

class TasksService
  extends SharedService<TaskId, TaskRecord>
  implements ITasksService
{
  private readonly taskQueue: (queueName: string) => ITaskQueue;

  constructor(
    private readonly context: TasksServiceContext,
    private readonly actions = {
      getTasksByStatus,
      getTasksByTaskName,
      getTasksByUserId,
      listTasks,
      getQueueStats,
      cancelTask,
      retryTask,
    },
    private readonly dependencies = {
      createTasksRepo,
      createTaskQueue,
    },
  ) {
    const appConfig = context.appConfig;
    super('tasks', {
      ...context,
      repo: () => this.dependencies.createTasksRepo({ appConfig }),
      newId: TaskIdConstructor,
    });
    this.taskQueue = (queueName: string) =>
      this.dependencies.createTaskQueue({
        queueName,
        logger: context.logger,
        appConfig,
      });
  }

  private get tasksRepo(): ITasksRepo {
    return this.dependencies.createTasksRepo({
      appConfig: this.context.appConfig,
    });
  }

  async getByStatus(
    status: TaskStatus,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
    return this.actions.getTasksByStatus(
      { tasksRepo: this.tasksRepo },
      { status },
    );
  }

  async getByTaskName(
    taskName: string,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
    return this.actions.getTasksByTaskName(
      { tasksRepo: this.tasksRepo },
      { taskName },
    );
  }

  async getByUserId(
    userId: UserId,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
    return this.actions.getTasksByUserId(
      { tasksRepo: this.tasksRepo },
      { userId },
    );
  }

  async listTasks(
    filters?: ListTasksFilters,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
    return this.actions.listTasks({ tasksRepo: this.tasksRepo }, { filters });
  }

  async getQueueStats(
    correlationId: CorrelationId,
    queueName: string,
  ): Promise<Result<QueueStats, ErrorWithMetadata>> {
    return this.actions.getQueueStats(
      {
        taskQueue: this.taskQueue,
      },
      {
        correlationId,
        queueName,
      },
    );
  }

  async retryTask(
    correlationId: CorrelationId,
    taskId: TaskId,
  ): Promise<Result<TaskRecord, ErrorWithMetadata>> {
    return this.actions.retryTask(
      {
        tasksRepo: this.tasksRepo,
        taskQueue: this.taskQueue,
        logger: this.context.logger,
      },
      {
        correlationId,
        taskId,
      },
    );
  }

  async cancelTask(
    correlationId: CorrelationId,
    taskId: TaskId,
  ): Promise<Result<TaskRecord, ErrorWithMetadata>> {
    return this.actions.cancelTask(
      {
        tasksRepo: this.tasksRepo,
        taskQueue: this.taskQueue,
        logger: this.context.logger,
      },
      {
        correlationId,
        taskId,
      },
    );
  }
}
