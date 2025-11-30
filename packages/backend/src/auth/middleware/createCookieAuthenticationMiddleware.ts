import type { IAuthService } from '@backend/auth/domain/AuthService';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { extractCookies } from '@backend/infrastructure/http/handlers/actions/extractCookies';
import { extractCorrelationId } from '@backend/infrastructure/http/handlers/actions/extractCorrelationId';
import type { IHttpMiddleware } from '@backend/infrastructure/http/handlers/domain/HttpMiddleware';
import type { Request } from '@backend/infrastructure/http/handlers/domain/Request';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { Permission } from '@core/domain/permissions/permissions';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

interface CookieAuthContext {
  logger: ILogger;
  auth: IAuthService;
  appConfig: IAppConfigurationService;
}

interface CookieAuthenticationConfig {
  requiredPermissions?: Permission[];
}

/**
 * Creates middleware for cookie-based authentication with permission validation.
 *
 * Flow:
 * 1. Extract or generate correlation ID for request tracing
 * 2. Extract cookies from request using coordinator
 * 3. Validate cookies exist (return Unauthorized if missing)
 * 4. Call UserAuthenticationService with cookie data and required permissions
 * 5. On success: enrich request.context with userSession and correlationId
 * 6. On failure: return error (Unauthorized, Forbidden, etc.)
 *
 * Architecture Note:
 * This middleware delegates actual authentication to UserAuthenticationService.
 * It's responsible for:
 * - Extracting request data (correlation ID, cookies)
 * - Calling the auth service
 * - Enriching the request with session data
 * - Error handling and logging
 *
 * The middleware DOES NOT perform authentication logic itself - that's the auth service's job.
 *
 * @param ctx - Context with logger, userAuth service, and request coordinator
 * @param config - Configuration with optional required permissions
 * @returns IHttpMiddleware instance with handle method
 */
export function createCookieAuthenticationMiddleware(
  ctx: CookieAuthContext,
  config: CookieAuthenticationConfig,
  actions = {
    extractCorrelationId,
    extractCookies,
  },
): IHttpMiddleware {
  return {
    handle: async (
      request: Request,
    ): Promise<Result<Request, ErrorWithMetadata>> => {
      const correlationId =
        request.context?.correlationId ?? actions.extractCorrelationId(request);

      ctx.logger.debug('Cookie authentication middleware executing', {
        correlationId,
        hasPermissions: !!config.requiredPermissions?.length,
      });

      const cookies = actions.extractCookies(ctx, {
        correlationId,
        request,
      });

      if (!cookies) {
        ctx.logger.info('Authentication failed: No cookies', {
          correlationId,
        });
        return err(
          new ErrorWithMetadata('Authentication required', 'Unauthorized', {
            correlationId,
          }),
        );
      }

      const token = cookies.get('auth');

      if (!token) {
        ctx.logger.info('Authentication failed: No auth cookie found', {
          correlationId,
        });
        return err(
          new ErrorWithMetadata('No auth cookie found', 'Unauthorized', {
            correlationId,
          }),
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

      ctx.logger.debug('Authenticating request from JWT token', {
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
        ctx.logger.info('Authentication failed', {
          correlationId,
          error: authResult.error.message,
        });
        return err(authResult.error);
      }

      ctx.logger.debug('Authentication successful', {
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
