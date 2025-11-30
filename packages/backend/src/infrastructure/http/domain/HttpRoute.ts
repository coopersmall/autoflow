import type { Request } from "@backend/infrastructure/http/handlers/domain/Request";
import zod from "zod";

/**
 * All valid route types as a constant array.
 * Useful for iteration and validation.
 */
export const routeType = zod.enum(["public", "api", "app"]);

/**
 * All valid HTTP methods as a constant array.
 * Useful for iteration and validation.
 */
export const httpMethods = zod.enum(["GET", "POST", "PUT", "DELETE"]);

/**
 * HTTP route types for request authentication/authorization levels.
 *
 * Route types determine the authentication middleware applied to a route:
 * - **public**: No authentication required, accessible to all users
 * - **api**: Bearer token authentication required for API endpoints
 * - **app**: Cookie-based authentication required for application UI endpoints
 *
 * @example
 * const route = factory.createRoute({
 *   path: '/api/users',
 *   routeType: 'api',  // Requires bearer token authentication
 *   requiredPermissions: ['read:users']
 *   handler: async (ctx) => { ... }
 * });
 */
export type RouteType = zod.infer<typeof routeType>;

/**
 * Standard HTTP methods supported by handlers.
 * These are the core REST operations for CRUD operations.
 */
export type HttpMethod = zod.infer<typeof httpMethods>;

/**
 * HTTP route definition combining path, method, and handler.
 *
 * Represents a single route registration in the HTTP server.
 * Routes are created by the route factory and registered with
 * the server for request handling.
 *
 * @example
 * ```ts
 * const route: IHttpRoute = {
 *   path: '/api/users/:id',
 *   method: 'GET',
 *   handler: async (req) => {
 *     const id = req.params.id;
 *     return Response.json({ id, name: 'User' });
 *   }
 * };
 * ```
 */
export interface IHttpRoute {
  /** URL path pattern (e.g., '/api/users/:id') */
  path: string;

  /** HTTP method for this route */
  method: HttpMethod;

  /**
   * Handler function that processes requests for this route.
   * Receives native Request and returns Response (sync or async).
   */
  handler: (req: Request) => Response | Promise<Response>;
}
