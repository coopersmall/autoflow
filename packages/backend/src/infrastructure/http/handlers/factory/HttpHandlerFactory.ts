import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IHttpRoute } from '@backend/infrastructure/http/domain/HttpRoute';
import type {
  CreateRouteRequest,
  IHttpRouteFactory,
} from '@backend/infrastructure/http/handlers/domain/HttpRouteFactory';
import type { RouteMiddlewareConfig } from '@backend/infrastructure/http/handlers/middleware/domain/MiddlewareConfig';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ExtractMethods } from '@core/types';
import { createRoute } from './actions/createRoute.ts';

export type IHttpHandlerFactoryService = ExtractMethods<HttpRouteFactory>;

export function createHttpRouteFactory(
  ctx: HttpRouteFactoryContext,
): IHttpHandlerFactoryService {
  return Object.freeze(new HttpRouteFactory(ctx));
}

interface HttpRouteFactoryContext {
  appConfig: IAppConfigurationService;
  logger: ILogger;
  middlewareConfig: RouteMiddlewareConfig;
}

interface HttpRouteFactoryActions {
  createRoute: typeof createRoute;
}

/**
 * Service for creating HTTP handlers with automatic middleware orchestration.
 * Handles the complete request processing pipeline: middleware → authentication → handler execution.
 *
 * Responsibilities:
 * - Create IHttpHandler instances from handler functions
 * - Automatically apply appropriate middleware based on route type (public/api/app)
 * - Orchestrate middleware execution in correct order
 * - Build request context after authentication
 * - Handle errors at every stage with proper HTTP status codes
 * - Provide comprehensive logging throughout the request lifecycle
 *
 * Handler Types:
 * - 'public': No authentication, no middleware
 * - 'api': Bearer token authentication with optional permissions
 * - 'app': Cookie-based authentication with optional permissions (for server-rendered pages)
 *
 * Architecture Note:
 * This service orchestrates the entire request flow:
 * 1. Determine required middleware based on route type
 * 2. Run middleware pipeline (may enrich request with session)
 * 3. Extract correlation ID from enriched request
 * 4. Build RequestContext with session data
 * 5. Execute handler function with context
 * 6. Convert any errors to appropriate HTTP responses
 *
 * Error Handling:
 * - Middleware errors → 401 (Unauthorized) or 403 (Forbidden)
 * - Handler errors → mapped based on error code (BadRequest→400, NotFound→404, etc.)
 * - Unknown errors → 500 (InternalServer)
 */
class HttpRouteFactory implements IHttpRouteFactory {
  constructor(
    private readonly context: HttpRouteFactoryContext,
    private readonly actions: HttpRouteFactoryActions = {
      createRoute,
    },
  ) {}

  /**
   * Creates an IHttpHandler that orchestrates middleware, authentication, and handler execution.
   *
   * The created handler:
   * 1. Determines and runs appropriate middleware based on routeType
   * 2. Extracts correlation ID for distributed tracing
   * 3. Builds RequestContext with session (if authenticated) and helper methods
   * 4. Executes the handler function with the context
   * 5. Handles errors at each stage with appropriate HTTP responses
   * 6. Logs all operations with correlation ID for debugging
   *
   * @param params - Handler creation parameters
   * @param params.path - URL path pattern (e.g., '/api/users/:id')
   * @param params.method - HTTP method (GET, POST, PUT, DELETE, PATCH)
   * @param params.routeType - Type determining middleware ('public', 'api', 'app')
   * @param params.requiredPermissions - Optional permissions required for api/app routes
   * @param params.handler - Function that processes the request and returns Response
   * @returns IHttpHandler with path, method, and handler function
   *
   * @example
   * ```typescript
   * // Public handler (no auth)
   * const publicHandler = handlerFactory.createRoute({
   *   path: '/health',
   *   method: 'GET',
   *   routeType: 'public',
   *   handler: async (ctx) => new Response('OK')
   * });
   *
   * // API handler with bearer token auth and permissions
   * const apiHandler = handlerFactory.createRoute({
   *   path: '/api/users/:id',
   *   method: 'GET',
   *   routeType: 'api',
   *   requiredPermissions: ['read:users'],
   *   handler: async (ctx) => {
   *     const userId = ctx.getParam('id', validUserId);
   *     // ... fetch and return user
   *   }
   * });
   * ```
   */
  createRoute(params: CreateRouteRequest): IHttpRoute {
    return this.actions.createRoute(
      {
        appConfig: this.context.appConfig,
        logger: this.context.logger,
        middlewareConfig: this.context.middlewareConfig,
      },
      params,
    );
  }
}
