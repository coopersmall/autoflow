import type { RequestContext } from '@backend/http/handlers/domain/RequestContext';
import { buildHttpErrorResponse } from '@backend/http/handlers/errors/buildHttpErrorResponse';
import type { ITasksService } from '@backend/tasks/domain/TasksService';
import { validTaskId } from '@backend/tasks/domain/validation/validTaskRecord';

/**
 * Context required for the getTaskById handler
 */
export interface GetTaskByIdHandlerContext {
  tasksService: ITasksService;
}

/**
 * Handler for GET /api/tasks/:id
 * Get a single task by ID
 */
export function getTaskByIdHandler(ctx: GetTaskByIdHandlerContext) {
  return async ({ getParam, correlationId }: RequestContext) => {
    const taskIdResult = getParam('id', validTaskId);
    if (taskIdResult.isErr()) {
      return buildHttpErrorResponse(taskIdResult.error);
    }

    const result = await ctx.tasksService.get(taskIdResult.value);
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
