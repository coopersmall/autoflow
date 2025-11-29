import type { RouteType } from '@backend/http/domain/HttpRoute';
import type { IHttpMiddleware } from '@backend/http/handlers/domain/HttpMiddleware';
import { createBearerTokenAuthenticationMiddleware } from '@backend/http/handlers/middleware/createBearerTokenAuthenticationMiddleware';
import { createCookieAuthenticationMiddleware } from '@backend/http/handlers/middleware/createCookieAuthenticationMiddleware';
import type { ILogger } from '@backend/logger/Logger';
import type { IUserAuthenticationService } from '@backend/services/auth/UserAuthenticationService';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { Permission } from '@core/domain/permissions/permissions';

interface GetMiddlewareForHandlerContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  userAuth: IUserAuthenticationService;
}

export interface GetMiddlewareForHandlerRequest {
  routeType: RouteType;
  requiredPermissions?: Permission[];
}

/**
 * Determines which middleware to apply based on handler type.
 *
 * Middleware Selection Rules:
 * - 'public': No middleware (empty array)
 * - 'api': Bearer token authentication with optional permissions
 * - 'app': Cookie authentication with optional permissions
 *
 * Architecture Note:
 * This is the decision point that separates public from authenticated handlers.
 * Public handlers skip all middleware for performance.
 *
 * API handlers get bearer token auth middleware which will:
 * 1. Extract Authorization header from request
 * 2. Validate "Bearer <token>" format
 * 3. Decode and validate JWT token
 * 4. Check required permissions
 * 5. Enrich request.context with userSession
 *
 * App handlers get cookie auth middleware which will:
 * 1. Extract auth cookie from request
 * 2. Decode and validate JWT token
 * 3. Check required permissions
 * 4. Enrich request.context with userSession
 *
 * @param request - Parameters object
 * @param params.handlerType - Handler type ('public', 'api', 'app')
 * @param params.requiredPermissions - Optional permissions to validate
 * @returns Array of middleware to execute (empty for public, bearer for api, cookie for app)
 */
export function getMiddlewareForHandler(
  ctx: GetMiddlewareForHandlerContext,
  request: GetMiddlewareForHandlerRequest,
): IHttpMiddleware[] {
  switch (request.routeType) {
    case 'api':
      return getMiddlewareForApiHandler(ctx, request);
    case 'app':
      return getMiddlewareForAppHandler(ctx, request);
    case 'public':
      return [];
  }
}

function getMiddlewareForApiHandler(
  ctx: GetMiddlewareForHandlerContext,
  request: GetMiddlewareForHandlerRequest,
): IHttpMiddleware[] {
  return [createBearerTokenAuthenticationMiddleware(ctx, request)];
}

function getMiddlewareForAppHandler(
  ctx: GetMiddlewareForHandlerContext,
  request: GetMiddlewareForHandlerRequest,
): IHttpMiddleware[] {
  return [createCookieAuthenticationMiddleware(ctx, request)];
}
