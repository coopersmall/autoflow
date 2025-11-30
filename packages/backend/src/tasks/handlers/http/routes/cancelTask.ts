import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import { buildHttpErrorResponse } from '@backend/infrastructure/http/handlers/errors/buildHttpErrorResponse';
import type { ITasksService } from '@backend/tasks/domain/TasksService';
import { validTaskId } from '@backend/tasks/domain/validation/validTaskRecord';

/**
 * Context required for the cancelTask handler
 */
export interface CancelTaskHandlerContext {
  tasksService: ITasksService;
}

/**
 * Handler for POST /api/tasks/:id/cancel
 * Cancel a pending or delayed task
 */
export function cancelTaskHandler(ctx: CancelTaskHandlerContext) {
  return async ({ getParam, correlationId }: RequestContext) => {
    const taskIdResult = getParam('id', validTaskId);
    if (taskIdResult.isErr()) {
      return buildHttpErrorResponse(taskIdResult.error);
    }

    const task = await ctx.tasksService.get(taskIdResult.value);
    if (task.isErr()) {
      return buildHttpErrorResponse(task.error);
    }

    const result = await ctx.tasksService.cancelTask(
      correlationId,
      taskIdResult.value,
    );

    if (result.isErr()) {
      return buildHttpErrorResponse(result.error);
    }

    return Response.json(
      {
        correlationId,
        task: result.value,
      },
      { status: 200 },
    );
  };
}
