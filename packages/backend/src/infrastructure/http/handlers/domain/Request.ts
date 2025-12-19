/**
 * HTTP request types for the handler layer.
 *
 * Extends Bun's native Request type with additional context for request processing.
 * The request context is enriched by middleware (authentication, correlation ID)
 * before reaching the handler.
 */
import { type Context, createContext } from '@backend/infrastructure/context';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { UsersSession } from '@core/domain/session/UsersSession';
import type { BunRequest } from 'bun';

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
// export interface Request extends BunRequest, RequestContext {}
export type Request = BunRequest & {
  /**
   * Service-layer context for passing to services, repositories, and caches.
   * Contains correlation ID and cancellation control.
   */
  ctx: Context;

  /**
   * User session data populated by authentication middleware.
   * Undefined for public routes or unauthenticated requests.
   */
  userSession?: UsersSession;
};

/**
 * Creates a Request object with an empty context.
 *
 * Used as the initial request passed into the middleware pipeline.
 *
 * @param request - BunRequest to wrap
 * @returns Request with empty context
 */
export function createRequestWithContext(
  correlationId: CorrelationId,
  request: BunRequest,
): Request {
  const controller = new AbortController();
  request.signal.addEventListener('abort', () => {
    controller.abort();
  });
  const requestWithContext = Object.assign(request, {
    ctx: createContext(correlationId, controller),
  });
  return requestWithContext;
}
