/**
 * Creates HTTP handlers with complete request processing pipeline.
 *
 * This is the main orchestrator for HTTP request handling. It combines:
 * - Middleware execution (authentication, authorization)
 * - Request context building (correlation ID, session, helpers)
 * - Handler function execution
 * - Error handling and HTTP response mapping
 * - Comprehensive logging throughout the pipeline
 *
 * Architecture:
 * This follows a clean layered architecture:
 * 1. Middleware layer: Runs before handler, can enrich request or reject early
 * 2. Context layer: Builds typed RequestContext from enriched request
 * 3. Handler layer: Business logic that processes the request
 * 4. Error layer: Converts errors to appropriate HTTP responses
 */

import type { CorrelationId } from '@autoflow/core';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IHttpRoute } from '@backend/infrastructure/http/domain/HttpRoute';
import { buildRequestContext } from '@backend/infrastructure/http/handlers/actions/buildRequestContext';
import { extractCorrelationId } from '@backend/infrastructure/http/handlers/actions/extractCorrelationId';
import type { CreateRouteRequest } from '@backend/infrastructure/http/handlers/domain/HttpRouteFactory';
import type { RouteMiddlewareConfig } from '@backend/infrastructure/http/handlers/middleware/domain/MiddlewareConfig';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { internalError, isAppError } from '@core/errors';
import type { BunRequest } from 'bun';
import { createRequestWithContext } from '../../domain/Request.ts';
import { createResponseFromError } from './createResponseFromError.ts';
import { runMiddleware } from './runMiddleware.ts';

interface CreateRouteContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  middlewareConfig: RouteMiddlewareConfig;
}

/**
 * Creates an HTTP handler with complete middleware orchestration and error handling.
 *
 * The created handler executes the following pipeline for each request:
 * 1. Determine required middleware based on route type
 * 2. Run middleware pipeline (authentication, etc.)
 * 3. Build request context with correlation ID and session
 * 4. Execute handler function
 * 5. Handle errors with appropriate HTTP responses
 *
 * @param ctx - Context with logger, request coordinator, and middleware service
 * @param params - Handler creation parameters
 * @param actions - Injectable actions for testing
 * @returns IHttpHandler with path, method, and handler function
 */
export function createRoute(
  ctx: CreateRouteContext,
  { path, method, routeType, requiredPermissions, handler }: CreateRouteRequest,
  actions = {
    createRequestWithContext,
    buildRequestContext,
    createResponseFromError,
    extractCorrelationId,
    handleThrownError,
    runMiddleware,
  },
): IHttpRoute {
  const fn = async (request: BunRequest): Promise<Response> => {
    const middlewareFactories = ctx.middlewareConfig[routeType];
    const middlewares = middlewareFactories.flatMap((factory) =>
      factory({ requiredPermissions }),
    );

    ctx.logger.debug('Processing handler request', {
      url: request.url,
      routeType,
      middlewareCount: middlewares.length,
    });

    const correlationId = actions.extractCorrelationId(request);
    const requestWithContext = actions.createRequestWithContext(
      correlationId,
      request,
    );

    const middlewareResult = await actions.runMiddleware(
      { logger: ctx.logger },
      {
        middlewares,
        request: requestWithContext,
      },
    );

    if (middlewareResult.isErr()) {
      ctx.logger.info('Middleware returned error', {
        error: middlewareResult.error.message,
        code: middlewareResult.error.code,
      });
      return actions.createResponseFromError(middlewareResult.error);
    }

    const enrichedRequest = middlewareResult.value;

    const requestContext = actions.buildRequestContext({
      ctx: requestWithContext.ctx,
      request: enrichedRequest,
    });

    ctx.logger.debug('Executing handler', {
      correlationId,
    });

    let response: Response;
    try {
      response = await handler(requestContext);
    } catch (error) {
      return actions.handleThrownError(
        ctx.logger,
        correlationId,
        error,
        actions,
      );
    }

    ctx.logger.debug('Handler completed successfully', {
      correlationId,
      status: response.status,
    });

    return response;
  };

  return {
    path,
    method,
    handler: fn,
  };
}

/**
 * Handles errors thrown by handler functions.
 * Wraps unknown errors in AppError and converts to HTTP responses.
 *
 * @param logger - Logger for error reporting
 * @param correlationId - Correlation ID for tracking
 * @param error - Error thrown by handler
 * @param actions - Injectable actions for response creation
 * @returns HTTP response with appropriate status code
 */
function handleThrownError(
  logger: ILogger,
  correlationId: CorrelationId,
  error: unknown,
  actions = {
    createResponseFromError,
  },
): Response {
  const err = isAppError(error)
    ? error
    : internalError('Unknown handler error', {
        cause: error,
        metadata: { correlationId },
      });

  logger.error('Handler error occurred', err, {
    correlationId,
    code: err.code,
  });

  return actions.createResponseFromError(err);
}
