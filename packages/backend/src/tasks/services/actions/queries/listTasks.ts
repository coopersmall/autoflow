import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type {
  ITasksRepo,
  ListTasksFilters,
} from '@backend/tasks/domain/TasksRepo';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface ListTasksContext {
  tasksRepo: ITasksRepo;
}

export interface ListTasksRequest {
  filters?: ListTasksFilters;
}

export async function listTasks(
  ctx: ListTasksContext,
  request: ListTasksRequest,
): Promise<Result<TaskRecord[], AppError>> {
  const result = await ctx.tasksRepo.listTasks(request.filters);

  if (result.isErr()) {
    return err(result.error);
  }

  return ok(result.value);
}
