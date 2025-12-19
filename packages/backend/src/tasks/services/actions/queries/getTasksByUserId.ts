import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface GetTasksByUserIdContext {
  tasksRepo: ITasksRepo;
}

export interface GetTasksByUserIdRequest {
  userId: UserId;
}

export async function getTasksByUserId(
  ctx: GetTasksByUserIdContext,
  request: GetTasksByUserIdRequest,
): Promise<Result<TaskRecord[], AppError>> {
  return await ctx.tasksRepo.getByUserId(request.userId);
}
