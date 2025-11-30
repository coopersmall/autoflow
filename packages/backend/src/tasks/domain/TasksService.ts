import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import type { ISharedService } from '@backend/infrastructure/services/SharedService';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import type { TaskId } from './TaskId';
import type { TaskRecord } from './TaskRecord';
import type { TaskStatus } from './TaskStatus';
import type { ListTasksFilters } from './TasksRepo';

export type ITasksService = Readonly<
  ISharedService<TaskId, TaskRecord> & {
    getByStatus(
      status: TaskStatus,
    ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;
    getByTaskName(
      taskName: string,
    ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;
    getByUserId(
      userId: UserId,
    ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;
    listTasks(
      filters?: ListTasksFilters,
    ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;
    getQueueStats(
      correlationId: CorrelationId,
      queueName: string,
    ): Promise<Result<QueueStats, ErrorWithMetadata>>;
    cancelTask(
      correlationId: CorrelationId,
      taskId: TaskId,
    ): Promise<Result<TaskRecord, ErrorWithMetadata>>;
    retryTask(
      correlationId: CorrelationId,
      taskId: TaskId,
    ): Promise<Result<TaskRecord, ErrorWithMetadata>>;
  }
>;
