import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type {
  ITasksRepo,
  ListTasksFilters,
} from '@backend/tasks/domain/TasksRepo';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
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
): Promise<Result<TaskRecord[], ErrorWithMetadata>> {
  const result = await ctx.tasksRepo.listTasks(request.filters);

  if (result.isErr()) {
    return err(result.error);
  }

  return ok(result.value);
}
