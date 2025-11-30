/**
 * Bearer token authentication middleware for JWT-based auth.
 *
 * Provides middleware for authenticating requests via JWT bearer tokens
 * in the Authorization header. Validates token signature, expiration,
 * and optional permission requirements.
 *
 * Flow:
 * 1. Extract or generate correlation ID for request tracing
 * 2. Extract Authorization header from request
 * 3. Validate header format: "Bearer <token>"
 * 4. Extract JWT token from header
 * 5. Call UserAuthenticationService with token and public key
 * 6. On success: enrich request.context with userSession and correlationId
 * 7. On failure: return error (Unauthorized, Forbidden, etc.)
 *
 * Architecture Note:
 * This middleware delegates actual authentication to UserAuthenticationService.
 * It's responsible for:
 * - Extracting request data (correlation ID, Authorization header)
 * - Validating header format
 * - Calling the auth service
 * - Enriching the request with session data
 * - Error handling and logging
 *
 * The middleware DOES NOT perform JWT verification itself - that's the auth service's job.
 *
 * Use Cases:
 * - API endpoints requiring JWT authentication
 * - Machine-to-machine authentication
 * - Mobile/SPA client authentication
 */

import type { IAuthService } from '@backend/auth/domain/AuthService';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { extractAuthHeader } from '@backend/infrastructure/http/handlers/actions/extractAuthHeader';
import { extractCorrelationId } from '@backend/infrastructure/http/handlers/actions/extractCorrelationId';
import type { IHttpMiddleware } from '@backend/infrastructure/http/handlers/domain/HttpMiddleware';
import type { Request } from '@backend/infrastructure/http/handlers/domain/Request';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { Permission } from '@core/domain/permissions/permissions';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

/**
 * Context required for bearer token authentication middleware.
 */
interface BearerTokenAuthContext {
  logger: ILogger;
  auth: IAuthService;
  appConfig: IAppConfigurationService;
}

/**
 * Configuration for bearer token authentication middleware.
 */
export interface BearerTokenAuthenticationConfig {
  /**
   * Optional permissions required for accessing the route.
   * If specified, user must have ALL listed permissions.
   */
  requiredPermissions?: Permission[];
}

/**
 * Creates middleware for bearer token (JWT) authentication with permission validation.
 *
 * @param ctx - Context with logger, userAuth service, and app configuration
 * @param config - Configuration with optional required permissions
 * @param actions - Injectable actions for testing
 * @returns IHttpMiddleware instance with handle method
 *
 * @example
 * ```ts
 * const authMiddleware = createBearerTokenAuthenticationMiddleware(
 *   { logger, userAuth, appConfig },
 *   { requiredPermissions: ['read:users'] }
 * );
 * ```
 */
export function createBearerTokenAuthenticationMiddleware(
  ctx: BearerTokenAuthContext,
  config: BearerTokenAuthenticationConfig,
  actions = {
    extractCorrelationId,
    extractAuthHeader,
  },
): IHttpMiddleware {
  return {
    handle: async (
      request: Request,
    ): Promise<Result<Request, ErrorWithMetadata>> => {
      const correlationId =
        request.context?.correlationId ?? actions.extractCorrelationId(request);

      ctx.logger.debug('Bearer token authentication middleware executing', {
        correlationId,
        hasPermissions: !!config.requiredPermissions?.length,
      });

      const authHeader = actions.extractAuthHeader(request);

      if (!authHeader) {
        ctx.logger.info('Authentication failed: No Authorization header', {
          correlationId,
        });
        return err(
          new ErrorWithMetadata(
            'No Authorization header found',
            'Unauthorized',
            {
              correlationId,
            },
          ),
        );
      }

      if (!authHeader.startsWith('Bearer ')) {
        ctx.logger.info(
          'Authentication failed: Invalid Authorization header format',
          {
            correlationId,
          },
        );
        return err(
          new ErrorWithMetadata(
            'Invalid Authorization header format. Expected: Bearer <token>',
            'Unauthorized',
            {
              correlationId,
            },
          ),
        );
      }

      const token = authHeader.substring(7);

      if (!token) {
        ctx.logger.info(
          'Authentication failed: No token in Authorization header',
          {
            correlationId,
          },
        );
        return err(
          new ErrorWithMetadata(
            'No token provided in Authorization header',
            'Unauthorized',
            {
              correlationId,
            },
          ),
        );
      }

      const publicKey = ctx.appConfig.jwtPublicKey;

      if (!publicKey) {
        const error = new ErrorWithMetadata(
          'JWT public key not configured',
          'InternalServer',
          {
            correlationId,
          },
        );
        ctx.logger.error('JWT public key not configured', error, {
          correlationId,
        });
        return err(error);
      }

      ctx.logger.debug('Authenticating request from bearer token', {
        correlationId,
      });

      const authResult = await ctx.auth.authenticate({
        type: 'jwt',
        token,
        publicKey,
        correlationId,
        requiredPermissions: config.requiredPermissions,
      });

      if (authResult.isErr()) {
        ctx.logger.info('Bearer token authentication failed', {
          correlationId,
          error: authResult.error.message,
        });
        return err(authResult.error);
      }

      ctx.logger.debug('Bearer token authentication successful', {
        correlationId,
        userId: authResult.value.userId,
      });

      // biome-ignore lint: Direct context assignment is intentional here to preserve request immutability
      request.context = {
        ...request.context,
        correlationId,
        userSession: authResult.value,
      };

      return ok(request);
    },
  };
}
