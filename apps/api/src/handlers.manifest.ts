import type {
  IAppConfigurationService,
  IHttpHandler,
  IHttpRouteFactory,
  ILogger,
  RouteMiddlewareConfig,
} from '@autoflow/backend';
import { createHttpRouteFactory } from '@autoflow/backend';
import { createAuthMiddlewareFactories } from '@autoflow/backend/auth';
import { createTasksHttpHandler } from '@autoflow/backend/tasks';
import { createAPIUserHandlers } from '@autoflow/backend/users';

/**
 * Handler dependencies required to create all HTTP handlers.
 */
export interface HandlerDeps {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}

/**
 * All HTTP handlers for this API server.
 *
 * This is the single source of truth for all HTTP endpoints
 * served by this API application.
 *
 * Architecture:
 * - Creates auth middleware factories from auth module
 * - Composes middleware configuration explicitly (no magic)
 * - Creates route factory with middleware config
 * - Passes route factory to all handlers via dependency injection
 *
 * To add new handlers:
 * 1. Create handlers in the appropriate feature module (e.g., packages/backend/src/users/handlers/)
 * 2. Export the handler factory from the feature module's index.ts
 * 3. Import the factory here
 * 4. Add it to the array returned by createHandlers()
 * 5. Pass routeFactory in the dependencies
 *
 * @example
 * ```typescript
 * // In packages/backend/src/secrets/index.ts
 * export { createSecretsHandlers } from './handlers/http/SecretsHttpHandler';
 *
 * // In this file
 * import { createSecretsHandlers } from '@autoflow/backend/secrets';
 *
 * export function createHandlers(deps: HandlerDeps): IHttpHandler[] {
 *   const routeFactory = createRouteFactory(deps);
 *   return [
 *     createAPIUserHandlers({ ...deps, routeFactory }),
 *     createTasksHttpHandler({ ...deps, routeFactory }),
 *     createSecretsHandlers({ ...deps, routeFactory }), // <- Add here
 *   ];
 * }
 * ```
 */
export function createHandlers(deps: HandlerDeps): IHttpHandler[] {
  const routeFactory = createRouteFactory(deps);

  return [
    createAPIUserHandlers({ ...deps, routeFactory }),
    createTasksHttpHandler({ ...deps, routeFactory }),
  ];
}

/**
 * Creates HTTP route factory with auth middleware configuration.
 *
 * This function wires together:
 * 1. Auth middleware factories (from auth module)
 * 2. Middleware configuration (maps route types to factories)
 * 3. Route factory (from infrastructure)
 *
 * The resulting route factory is passed to all handlers, allowing them
 * to create routes with the appropriate middleware applied.
 */
function createRouteFactory(deps: HandlerDeps): IHttpRouteFactory {
  // Create auth middleware factories
  const auth = createAuthMiddlewareFactories({
    logger: deps.logger,
    appConfig: deps.appConfig,
  });

  // Configure middleware for each route type
  const middlewareConfig: RouteMiddlewareConfig = {
    api: [auth.bearerToken],
    app: [auth.cookie],
    public: [],
  };

  // Create route factory with middleware config
  return createHttpRouteFactory({
    appConfig: deps.appConfig,
    logger: deps.logger,
    middlewareConfig,
  });
}
