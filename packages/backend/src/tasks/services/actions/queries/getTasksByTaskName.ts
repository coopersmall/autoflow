import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface GetTasksByTaskNameContext {
  tasksRepo: ITasksRepo;
}

export interface GetTasksByTaskNameRequest {
  taskName: string;
}

export async function getTasksByTaskName(
  ctx: GetTasksByTaskNameContext,
  request: GetTasksByTaskNameRequest,
): Promise<Result<TaskRecord[], AppError>> {
  return await ctx.tasksRepo.getByTaskName(request.taskName);
}
