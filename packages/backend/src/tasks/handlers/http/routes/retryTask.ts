import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import { buildHttpErrorResponse } from '@backend/infrastructure/http/handlers/errors/buildHttpErrorResponse';
import type { ITasksService } from '@backend/tasks/domain/TasksService';
import { validTaskId } from '@backend/tasks/domain/validation/validTaskRecord';

/**
 * Context required for the retryTask handler
 */
export interface RetryTaskHandlerContext {
  tasksService: ITasksService;
}

/**
 * Handler for POST /api/tasks/:id/retry
 * Retry a failed task
 */
export function retryTaskHandler(ctx: RetryTaskHandlerContext) {
  return async (requestContext: RequestContext) => {
    const { ctx: context, getParam } = requestContext;

    const taskIdResult = getParam('id', validTaskId);
    if (taskIdResult.isErr()) {
      return buildHttpErrorResponse(taskIdResult.error);
    }

    const task = await ctx.tasksService.get(context, taskIdResult.value);
    if (task.isErr()) {
      return buildHttpErrorResponse(task.error);
    }

    const result = await ctx.tasksService.retryTask(
      context,
      taskIdResult.value,
    );

    if (result.isErr()) {
      return buildHttpErrorResponse(result.error);
    }

    return Response.json(
      {
        correlationId: context.correlationId,
        task: result.value,
      },
      { status: 200 },
    );
  };
}
