/**
 * HTTP handler abstraction for grouping related routes.
 *
 * Handlers provide a way to organize routes by resource or feature.
 * Multiple handlers can be registered with a server, each contributing
 * their own set of routes.
 *
 * Common Patterns:
 * - CRUD handlers (SharedHttpHandler, StandardHttpHandler)
 * - Feature-specific handlers (auth, webhooks, etc.)
 * - Resource handlers (users, documents, etc.)
 */
import type { IHttpRoute } from './HttpRoute';

/**
 * HTTP handler interface for providing route definitions.
 *
 * Handlers encapsulate related routes and return them via the routes() method.
 * This allows grouping routes by resource, feature, or concern.
 *
 * @example
 * ```ts
 * class UsersHandler implements IHttpHandler {
 *   routes(): IHttpRoute[] {
 *     return [
 *       { path: '/api/users', method: 'GET', handler: this.list },
 *       { path: '/api/users/:id', method: 'GET', handler: this.get },
 *       { path: '/api/users', method: 'POST', handler: this.create }
 *     ];
 *   }
 * }
 * ```
 */
export interface IHttpHandler {
  /**
   * Returns all routes provided by this handler.
   *
   * @returns Array of HTTP route definitions
   */
  routes(): IHttpRoute[];
}
