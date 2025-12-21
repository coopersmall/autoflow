/**
 * HTTP middleware abstraction for request processing pipeline.
 *
 * Middleware intercepts requests before they reach handlers, enabling:
 * - Authentication (verify identity, populate session)
 * - Authorization (check permissions)
 * - Request enrichment (add correlation ID, logging context)
 * - Early rejection (invalid requests, missing auth)
 *
 * Middleware can modify the request (enriching context) or reject it early
 * by returning an error Result. The middleware pipeline runs sequentially,
 * with each middleware receiving the enriched request from the previous one.
 *
 * Architecture:
 * - Returns Result types for functional error handling
 * - Middleware runs before handler execution
 * - Can enrich request.context with session, correlation ID, etc.
 * - Errors short-circuit the pipeline and return HTTP error responses
 */
import type { AppError } from '@core/errors';
import type { Result } from 'neverthrow';
import type { Request } from './Request';

/**
 * HTTP middleware interface for request processing.
 *
 * Middleware receives a request and can either:
 * - Return ok(enrichedRequest) to continue pipeline
 * - Return err(error) to reject and return error response
 *
 * @example
 * ```ts
 * const authMiddleware: IHttpMiddleware = {
 *   handle: async (request) => {
 *     const session = await authenticate(request);
 *     if (!session) {
 *       return err(unauthorized('Unauthorized'));
 *     }
 *     request.context.userSession = session;
 *     return ok(request);
 *   }
 * };
 * ```
 */
export interface IHttpMiddleware {
  /**
   * Processes an HTTP request, potentially enriching or rejecting it.
   *
   * @param request - HTTP request to process (may be enriched by previous middleware)
   * @returns Result with enriched request or error for rejection
   */
  handle: (request: Request) => Promise<Result<Request, AppError>>;
}
