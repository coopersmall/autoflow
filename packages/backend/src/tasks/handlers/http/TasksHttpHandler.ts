import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IHttpHandler } from '@backend/infrastructure/http/domain/HttpHandler';
import type { IHttpRoute } from '@backend/infrastructure/http/domain/HttpRoute';
import type { IHttpRouteFactory } from '@backend/infrastructure/http/handlers/domain/HttpRouteFactory';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ITasksService } from '@backend/tasks/domain/TasksService';
import { createTasksService } from '@backend/tasks/services/TasksService';
import { cancelTaskHandler } from './routes/cancelTask';
import { getQueueStatsHandler } from './routes/getQueueStats';
import { getTaskByIdHandler } from './routes/getTaskById';
import { listTasksHandler } from './routes/listTasks';
import { retryTaskHandler } from './routes/retryTask';

export function createTasksHttpHandler(
  context: TasksHttpHandlerContext,
): IHttpHandler {
  return Object.freeze(new TasksHttpHandler(context));
}

interface TasksHttpHandlerContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  routeFactory: IHttpRouteFactory;
}

interface TasksHttpHandlerDependencies {
  createTasksService: typeof createTasksService;
}

/**
 * HTTP handler for task management operations.
 *
 * Provides admin-only endpoints for:
 * - Viewing task history and details
 * - Retrying failed tasks
 * - Cancelling pending/delayed tasks
 * - Viewing task statistics
 * - Monitoring BullMQ queue status
 *
 * All routes require admin permissions and use the existing
 * HTTP infrastructure for authentication and authorization.
 */
class TasksHttpHandler implements IHttpHandler {
  private readonly factory: IHttpRouteFactory;
  private readonly tasksService: ITasksService;

  constructor(
    private readonly ctx: TasksHttpHandlerContext,
    private readonly dependencies: TasksHttpHandlerDependencies = {
      createTasksService,
    },
  ) {
    this.factory = ctx.routeFactory;

    this.tasksService = dependencies.createTasksService({
      logger: ctx.logger,
      appConfig: ctx.appConfig,
    });
  }

  /**
   * Returns all HTTP routes provided by this handler.
   * All routes are admin-only and use the 'api' route type.
   */
  routes(): IHttpRoute[] {
    // Create handler context - shared dependencies for all route handlers
    const handlerContext = {
      tasksService: this.tasksService,
    };

    return [
      // GET /api/tasks/:id - Get a single task by ID
      this.factory.createRoute({
        path: '/api/tasks/:id',
        method: 'GET',
        routeType: 'api',
        requiredPermissions: ['admin'],
        handler: getTaskByIdHandler(handlerContext),
      }),

      // GET /api/tasks - List all tasks
      this.factory.createRoute({
        path: '/api/tasks',
        method: 'GET',
        routeType: 'api',
        requiredPermissions: ['admin'],
        handler: listTasksHandler(handlerContext),
      }),

      // GET /api/tasks/stats/queue/:queueName - Get queue statistics
      this.factory.createRoute({
        path: '/api/tasks/stats/queue/:queueName',
        method: 'GET',
        routeType: 'api',
        requiredPermissions: ['admin'],
        handler: getQueueStatsHandler(handlerContext),
      }),

      // POST /api/tasks/:id/retry - Retry a failed task
      this.factory.createRoute({
        path: '/api/tasks/:id/retry',
        method: 'POST',
        routeType: 'api',
        requiredPermissions: ['admin'],
        handler: retryTaskHandler(handlerContext),
      }),

      // POST /api/tasks/:id/cancel - Cancel a pending task
      this.factory.createRoute({
        path: '/api/tasks/:id/cancel',
        method: 'POST',
        routeType: 'api',
        requiredPermissions: ['admin'],
        handler: cancelTaskHandler(handlerContext),
      }),
    ];
  }
}
