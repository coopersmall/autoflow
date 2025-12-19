import type { IHttpMiddleware } from '@backend/infrastructure/http/handlers/domain/HttpMiddleware';
import type { Request } from '@backend/infrastructure/http/handlers/domain/Request';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface RunMiddlewareContext {
  logger: ILogger;
}

export interface RunMiddlewareRequest {
  middlewares: IHttpMiddleware[];
  request: Request;
}

/**
 * Executes an array of middleware in sequence, passing request through the pipeline.
 *
 * Middleware Pipeline:
 * - Each middleware receives the request and returns Result<Request, Error>
 * - Success: Modified request is passed to next middleware
 * - Error: Pipeline stops immediately and error is returned
 * - Final result is the request after all middleware transformations
 *
 * Common Middleware Transformations:
 * - Add correlation ID to request.context
 * - Add userSession to request.context after authentication
 * - Add custom metadata to request.context
 *
 * Error Handling:
 * - First middleware error stops the pipeline
 * - Error is logged with correlation ID and request URL
 * - Error is returned to handler factory for HTTP response mapping
 *
 * @param ctx - Context with logger for error reporting
 * @param params - Parameters object
 * @param params.middlewares - Array of middleware to execute in order
 * @param params.request - Initial HTTP request to pass through pipeline
 * @returns Result containing final transformed request or first error encountered
 */
export async function runMiddleware(
  ctx: RunMiddlewareContext,
  { middlewares, request }: RunMiddlewareRequest,
): Promise<Result<Request, AppError>> {
  for (const middleware of middlewares) {
    const result = await middleware.handle(request);

    if (result.isErr()) {
      ctx.logger.error('Middleware error', result.error, {
        url: request.url,
        correlationId: request.ctx?.correlationId,
      });
      return err(result.error);
    }

    request = result.value;
  }

  return ok(request);
}
