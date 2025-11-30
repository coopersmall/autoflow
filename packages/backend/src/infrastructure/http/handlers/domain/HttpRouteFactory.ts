/**
 * HTTP route factory abstraction for creating routes with middleware orchestration.
 *
 * The route factory is responsible for creating HTTP routes that automatically
 * apply the correct middleware based on route type (public, api, app). It handles
 * the complete request pipeline from middleware execution through handler invocation.
 *
 * Architecture:
 * - Abstracts route creation to encapsulate middleware selection logic
 * - Provides type-safe route configuration
 * - Enables dependency injection for testing
 * - Ensures consistent middleware application across the application
 */
import type {
  HttpMethod,
  IHttpRoute,
  RouteType,
} from '@backend/infrastructure/http/domain/HttpRoute';
import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { Permission } from '@core/domain/permissions/permissions';

/**
 * Factory interface for creating HTTP routes with automatic middleware orchestration.
 */
export interface IHttpRouteFactory {
  /**
   * Creates an HTTP route with appropriate middleware based on route type.
   *
   * @param request - Route configuration parameters
   * @returns HTTP route with path, method, and handler function
   */
  createRoute(request: CreateRouteRequest): IHttpRoute;
}

/**
 * Configuration for creating an HTTP route.
 *
 * Defines the route's path, method, type (which determines middleware),
 * optional permissions, and the handler function to execute.
 */
export interface CreateRouteRequest {
  /** URL path pattern, e.g., '/api/users/:id' */
  path: string;

  /** HTTP method (GET, POST, PUT, DELETE, PATCH) */
  method: HttpMethod;

  /**
   * Route type determines middleware: 'public' (none), 'api' (bearer), 'app' (cookie)
   * - 'public': No authentication required
   * - 'api': Bearer token authentication for API endpoints
   * - 'app': Cookie-based authentication for server-rendered pages
   */
  routeType: RouteType;

  /**
   * Optional permissions required for authenticated handlers.
   * Only applies to 'api' and 'app' route types.
   */
  requiredPermissions?: Permission[];

  /**
   * Handler function that processes request and returns HTTP response.
   * Receives typed RequestContext with session, params, body helpers.
   */
  handler: (context: RequestContext) => Promise<Response> | Response;
}
