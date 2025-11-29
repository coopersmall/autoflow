import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { TaskStatus } from '@backend/tasks/domain/TaskStatus';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export interface GetTasksByStatusContext {
  tasksRepo: ITasksRepo;
}

export interface GetTasksByStatusRequest {
  status: TaskStatus;
}

export async function getTasksByStatus(
  ctx: GetTasksByStatusContext,
  request: GetTasksByStatusRequest,
): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
  return await ctx.tasksRepo.getByStatus(request.status);
}
