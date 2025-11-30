import type { IHttpHandler } from '@backend/infrastructure/http/domain/HttpHandler';
import type { RouteHandlers } from '@backend/infrastructure/http/server/domain/HttpRouteHandlers';
import { buildRoute } from './buildRoute.ts';

export type BuildRouteHandlersContext = Record<string, never>;

export type BuildRouteHandlersRequest = {
  readonly handlers: IHttpHandler[];
};

/**
 * Builds a route handlers registry from HTTP handlers.
 * Flattens all routes from all handlers and adds them to the registry.
 *
 * @param _ctx - Context (unused)
 * @param request - HTTP handlers to extract routes from
 * @returns Complete route handlers registry
 */
export function buildRouteHandlers(
  _ctx: BuildRouteHandlersContext,
  request: BuildRouteHandlersRequest,
): RouteHandlers {
  let routes: RouteHandlers = {};

  const allRoutes = request.handlers.flatMap((h) => h.routes());

  for (const route of allRoutes) {
    routes = buildRoute({}, { route, currentRoutes: routes });
  }

  return routes;
}
