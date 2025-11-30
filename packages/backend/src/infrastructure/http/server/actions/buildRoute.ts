import type { IHttpRoute } from '@backend/infrastructure/http/domain/HttpRoute';
import type { RouteHandlers } from '@backend/infrastructure/http/server/domain/HttpRouteHandlers';
import { produce } from 'immer';

export type BuildRouteContext = Record<string, never>;

export type BuildRouteRequest = {
  readonly route: IHttpRoute;
  readonly currentRoutes: RouteHandlers;
};

/**
 * Adds a single route to the route handlers registry.
 * Uses immer for immutable updates.
 *
 * @param _ctx - Context (unused)
 * @param request - Route and current routes
 * @returns Updated route handlers with new route
 */
export function buildRoute(
  _ctx: BuildRouteContext,
  request: BuildRouteRequest,
): RouteHandlers {
  return produce(request.currentRoutes, (draft) => {
    if (!draft[request.route.path]) {
      draft[request.route.path] = {};
    }
    draft[request.route.path][request.route.method] = request.route.handler;
  });
}
