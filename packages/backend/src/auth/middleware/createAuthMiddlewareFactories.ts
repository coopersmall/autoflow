/**
 * Factory for creating auth middleware factories.
 *
 * Provides pre-configured middleware factory functions that can be composed
 * at the application level. This allows the auth module to own its middleware
 * while keeping infrastructure generic.
 *
 * Architecture:
 * - Auth module creates and configures its own middleware
 * - Returns factory functions (not instances) that accept MiddlewareConfig
 * - App-level code composes these factories into RouteMiddlewareConfig
 * - Infrastructure remains auth-agnostic
 *
 * @example
 * ```ts
 * // In app-level handlers.manifest.ts
 * const auth = createAuthMiddlewareFactories({ logger, appConfig });
 *
 * const middlewareConfig: RouteMiddlewareConfig = {
 *   api: [auth.bearerToken],
 *   app: [auth.cookie],
 *   public: [],
 * };
 * ```
 */

import type { IAuthService } from '@backend/auth/domain/AuthService';
import { createAuthService } from '@backend/auth/services/AuthService';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { MiddlewareFactory } from '@backend/infrastructure/http/handlers/middleware/domain/MiddlewareConfig';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { createBearerTokenAuthenticationMiddleware } from './createBearerTokenAuthenticationMiddleware';
import { createCookieAuthenticationMiddleware } from './createCookieAuthenticationMiddleware';

/**
 * Context required for creating auth middleware factories.
 */
export interface AuthMiddlewareFactoriesContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}

/**
 * Auth middleware factories for different authentication methods.
 */
export interface AuthMiddlewareFactories {
  /**
   * Bearer token authentication middleware factory.
   * For API routes that use JWT in Authorization header.
   */
  bearerToken: MiddlewareFactory;

  /**
   * Cookie-based authentication middleware factory.
   * For app routes that use cookies for session management.
   */
  cookie: MiddlewareFactory;

  /**
   * No authentication middleware factory.
   * For public routes that don't require authentication.
   */
  none: MiddlewareFactory;
}

/**
 * Creates auth middleware factories with injected dependencies.
 *
 * Returns an object containing factory functions for different authentication
 * methods. Each factory accepts a MiddlewareConfig and returns middleware instances.
 *
 * @param ctx - Context with logger and app configuration
 * @param deps - Optional dependencies for testing
 * @returns Object with bearerToken, cookie, and none factory functions
 *
 * @example
 * ```ts
 * const auth = createAuthMiddlewareFactories({ logger, appConfig });
 *
 * // Use in route middleware config
 * const middlewareConfig = {
 *   api: [auth.bearerToken],
 *   app: [auth.cookie],
 *   public: [],
 * };
 * ```
 */
export function createAuthMiddlewareFactories(
  ctx: AuthMiddlewareFactoriesContext,
  deps: {
    createAuthService?: (ctx: {
      logger: ILogger;
      appConfig: () => IAppConfigurationService;
    }) => IAuthService;
  } = {},
): AuthMiddlewareFactories {
  const { createAuthService: createAuthServiceDep = createAuthService } = deps;

  // Create auth service once, reuse across all middleware
  const authService = createAuthServiceDep({
    logger: ctx.logger,
    appConfig: () => ctx.appConfig,
  });

  const middlewareContext = {
    logger: ctx.logger,
    auth: authService,
    appConfig: ctx.appConfig,
  };

  return {
    bearerToken: (config) => [
      createBearerTokenAuthenticationMiddleware(middlewareContext, config),
    ],
    cookie: (config) => [
      createCookieAuthenticationMiddleware(middlewareContext, config),
    ],
    none: () => [],
  };
}
