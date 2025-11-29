import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
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
): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
  return await ctx.tasksRepo.getByUserId(request.userId);
}
