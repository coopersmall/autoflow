/**
 * HTTP request types for the handler layer.
 *
 * Extends Bun's native Request type with additional context for request processing.
 * The request context is enriched by middleware (authentication, correlation ID)
 * before reaching the handler.
 */
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { UsersSession } from '@core/domain/session/UsersSession';
import type { BunRequest } from 'bun';

/**
 * Internal request context attached to requests during middleware execution.
 * This is the raw context before being transformed into the full RequestContext
 * passed to handlers.
 */
interface RequestContext {
  /**
   * Correlation ID for distributed tracing.
   * Set by middleware or generated from request headers.
   */
  correlationId?: CorrelationId;

  /**
   * User session data populated by authentication middleware.
   * Undefined for public routes or unauthenticated requests.
   */
  userSession?: UsersSession;
}

/**
 * HTTP request with enriched context for middleware and handler processing.
 *
 * Extends Bun's native Request with a context object that middleware can populate.
 * This request flows through the middleware pipeline where it gets enriched with
 * correlation ID and user session before being transformed into RequestContext
 * for the handler.
 *
 * @example
 * ```ts
 * // Middleware enriches the request
 * const middleware: IHttpMiddleware = {
 *   handle: async (request: Request) => {
 *     request.context.userSession = await authenticate(request);
 *     return ok(request);
 *   }
 * };
 * ```
 */
export interface Request extends BunRequest {
  context?: RequestContext;
}

/**
 * Creates a Request object with an empty context.
 *
 * Used as the initial request passed into the middleware pipeline.
 *
 * @param request - BunRequest to wrap
 * @returns Request with empty context
 */
export function createRequestWithContext(request: BunRequest): Request {
  const requestWithContext = Object.assign(request, { context: {} });
  return requestWithContext;
}
