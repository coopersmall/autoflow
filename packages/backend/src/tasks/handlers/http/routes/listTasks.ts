import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import { buildHttpErrorResponse } from '@backend/infrastructure/http/handlers/errors/buildHttpErrorResponse';
import type { ITasksService } from '@backend/tasks/domain/TasksService';
import {
  validOptionalLimitParam,
  validOptionalOffsetParam,
  validOptionalTaskNameParam,
  validOptionalTaskStatusParam,
  validOptionalUserIdParam,
} from './validation/validListTaskParams.ts';

/**
 * Context required for the listTasks handler
 */
export interface ListTasksHandlerContext {
  tasksService: ITasksService;
}

/**
 * Handler for GET /api/tasks
 * List tasks with optional filtering and pagination
 *
 * Query params:
 * - status: Filter by task status (pending|active|completed|failed|delayed|cancelled)
 * - taskName: Filter by task name
 * - userId: Filter by user ID
 * - limit: Max results (default: 100, max: 100)
 * - offset: Skip N results (default: 0)
 */
export function listTasksHandler(ctx: ListTasksHandlerContext) {
  return async (requestContext: RequestContext) => {
    // Extract and validate all query parameters using getSearchParam
    const statusResult = requestContext.getSearchParam(
      'status',
      validOptionalTaskStatusParam,
    );
    if (statusResult.isErr()) {
      return buildHttpErrorResponse(statusResult.error);
    }

    const taskNameResult = requestContext.getSearchParam(
      'taskName',
      validOptionalTaskNameParam,
    );
    if (taskNameResult.isErr()) {
      return buildHttpErrorResponse(taskNameResult.error);
    }

    const userIdResult = requestContext.getSearchParam(
      'userId',
      validOptionalUserIdParam,
    );
    if (userIdResult.isErr()) {
      return buildHttpErrorResponse(userIdResult.error);
    }

    const limitResult = requestContext.getSearchParam(
      'limit',
      validOptionalLimitParam,
    );
    if (limitResult.isErr()) {
      return buildHttpErrorResponse(limitResult.error);
    }

    const offsetResult = requestContext.getSearchParam(
      'offset',
      validOptionalOffsetParam,
    );
    if (offsetResult.isErr()) {
      return buildHttpErrorResponse(offsetResult.error);
    }

    // Build filters object (only include defined values)
    const filters = {
      status: statusResult.value,
      taskName: taskNameResult.value,
      userId: userIdResult.value,
      limit: limitResult.value,
      offset: offsetResult.value,
    };

    // Call service with validated filters
    const result = await ctx.tasksService.listTasks(filters);

    if (result.isErr()) {
      return buildHttpErrorResponse(result.error);
    }

    const tasks = result.value;

    // Return tasks with metadata
    return Response.json(
      {
        correlationId: requestContext.ctx.correlationId,
        tasks,
        count: tasks.length,
        limit: filters.limit,
        offset: filters.offset,
      },
      { status: 200 },
    );
  };
}
