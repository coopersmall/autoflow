import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import { buildHttpErrorResponse } from '@backend/infrastructure/http/handlers/errors/buildHttpErrorResponse';
import type { ITasksService } from '@backend/tasks/domain/TasksService';
import { string } from '@core/validation/validate';

/**
 * Context required for the getQueueStats handler
 */
export interface GetQueueStatsHandlerContext {
  tasksService: ITasksService;
}

/**
 * Handler for GET /api/tasks/stats/queue/:queueName
 * Get BullMQ queue statistics (waiting, active, completed, failed, delayed)
 */
export function getQueueStatsHandler(ctx: GetQueueStatsHandlerContext) {
  return async ({ correlationId, getParam }: RequestContext) => {
    const queueNameResult = getParam('queueName', string);
    if (queueNameResult.isErr()) {
      return buildHttpErrorResponse(queueNameResult.error);
    }
    const queueName = queueNameResult.value;

    // Call service method to get queue statistics
    const result = await ctx.tasksService.getQueueStats(
      correlationId,
      queueName,
    );

    if (result.isErr()) {
      return buildHttpErrorResponse(result.error);
    }

    return Response.json(
      {
        correlationId,
        stats: result.value,
      },
      { status: 200 },
    );
  };
}
