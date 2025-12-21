import type { Context } from '@backend/infrastructure/context';
import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import type { ISharedService } from '@backend/infrastructure/services/SharedService';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { TaskId } from './TaskId';
import type { TaskRecord } from './TaskRecord';
import type { TaskStatus } from './TaskStatus';
import type { ListTasksFilters } from './TasksRepo';

export type ITasksService = Readonly<
  ISharedService<TaskId, TaskRecord> & {
    getByStatus(status: TaskStatus): Promise<Result<TaskRecord[], AppError>>;
    getByTaskName(taskName: string): Promise<Result<TaskRecord[], AppError>>;
    getByUserId(userId: UserId): Promise<Result<TaskRecord[], AppError>>;
    listTasks(
      filters?: ListTasksFilters,
    ): Promise<Result<TaskRecord[], AppError>>;
    getQueueStats(
      ctx: Context,
      queueName: string,
    ): Promise<Result<QueueStats, AppError>>;
    cancelTask(
      ctx: Context,
      taskId: TaskId,
    ): Promise<Result<TaskRecord, AppError>>;
    retryTask(
      ctx: Context,
      taskId: TaskId,
    ): Promise<Result<TaskRecord, AppError>>;
  }
>;
