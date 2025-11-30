/**
 * Middleware configuration types for HTTP route handlers.
 *
 * Defines how middleware factories are composed and applied to different
 * route types (api, app, public) without any knowledge of specific
 * authentication implementations.
 *
 * Architecture:
 * - Infrastructure defines the types and contracts
 * - Feature modules (auth, etc.) provide MiddlewareFactory implementations
 * - App-level code wires everything together explicitly
 *
 * This allows infrastructure to remain generic while features provide
 * specific implementations that get composed at the application boundary.
 */

import type { Permission } from '@core/domain/permissions/permissions';
import type { IHttpMiddleware } from '../../domain/HttpMiddleware.ts';

/**
 * Configuration passed to middleware factories.
 * Contains optional settings like required permissions.
 */
export interface MiddlewareConfig {
  /**
   * Optional permissions required for accessing the route.
   * If specified, user must have ALL listed permissions.
   */
  requiredPermissions?: Permission[];
}

/**
 * Factory function that creates middleware instances.
 * Takes configuration and returns an array of middleware to apply.
 *
 * @example
 * ```ts
 * const authFactory: MiddlewareFactory = (config) => [
 *   createBearerTokenMiddleware(ctx, config)
 * ];
 * ```
 */
export type MiddlewareFactory = (config: MiddlewareConfig) => IHttpMiddleware[];

/**
 * Configuration mapping route types to their middleware factories.
 *
 * Defines which middleware factories should be applied to each route type:
 * - api: API routes (typically require bearer token authentication)
 * - app: Application routes (typically use cookie-based authentication)
 * - public: Public routes (no authentication required)
 *
 * @example
 * ```ts
 * const middlewareConfig: RouteMiddlewareConfig = {
 *   api: [authFactory.bearerToken, rateLimitFactory],
 *   app: [authFactory.cookie],
 *   public: [],
 * };
 * ```
 */
export interface RouteMiddlewareConfig {
  api: MiddlewareFactory[];
  app: MiddlewareFactory[];
  public: MiddlewareFactory[];
}
