import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { TaskStatus } from '@backend/tasks/domain/TaskStatus';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import type { AppError } from '@core/errors/AppError';
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
): Promise<Result<TaskRecord[], AppError>> {
  return await ctx.tasksRepo.getByStatus(request.status);
}
