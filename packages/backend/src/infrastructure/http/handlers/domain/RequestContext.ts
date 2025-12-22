import type { Context } from '@backend/infrastructure/context';
import type { UsersSession } from '@core/domain/user-session/UsersSession';
import type { AppError } from '@core/errors';

import type { Validator } from '@core/validation/validate';
import type { Result } from 'neverthrow';

/**
 * HTTP request context passed to all request handlers.
 * This is the single source of truth for request context across the application.
 *
 * Provides access to:
 * - Correlation ID for request tracking
 * - Service-layer Context for passing to services/repos/caches
 * - User session (if authenticated)
 * - Route parameters with validation
 * - Query string parameters with validation
 * - Request body parsing with validation
 * - Request headers
 */
export interface RequestContext {
  /**
   * Service-layer context containing correlation ID and cancellation control.
   * Pass this to all service, repo, and cache operations.
   *
   * @example
   * const result = await service.get(requestContext.ctx, itemId);
   */
  ctx: Context;

  /**
   * Authenticated user session containing user ID and permissions.
   * Undefined for public routes that don't require authentication.
   *
   * @example
   * if (!context.session) {
   *   return Response.json({ error: 'Unauthorized' }, { status: 401 });
   * }
   * const userId = context.session.userId;
   */
  session?: UsersSession;

  /**
   * Extracts and validates a route parameter by name.
   *
   * @param name - Parameter name from route path (e.g., 'id' from '/users/:id')
   * @param validator - Validation function to parse and validate the parameter
   * @returns Result with validated value or validation error
   *
   * @example
   * const userId = context.getParam('id', (value) => {
   *   if (!value) return err(new AppError('User ID required'));
   *   return ok(UserId(value));
   * });
   */
  getParam: <T>(name: string, validator: Validator<T>) => Result<T, AppError>;

  /**
   * Extracts and validates a query string parameter by name.
   *
   * @param name - Query parameter name (e.g., 'page' from '?page=1')
   * @param validator - Validation function to parse and validate the parameter
   * @returns Result with validated value or validation error
   *
   * @example
   * const page = context.getSearchParam('page', (value) => {
   *   const num = parseInt(value ?? '1', 10);
   *   return isNaN(num) ? err(new AppError('Invalid page')) : ok(num);
   * });
   */
  getSearchParam: <T>(
    name: string,
    validator: Validator<T>,
  ) => Result<T, AppError>;

  /**
   * Parses and validates the request body as JSON.
   *
   * @param validator - Validation function to parse and validate the body
   * @returns Promise resolving to validated body or validation error
   *
   * @example
   * const body = await context.getBody((data) => {
   *   const schema = z.object({ name: z.string(), email: z.string().email() });
   *   const result = schema.safeParse(data);
   *   return result.success ? ok(result.data) : err(new AppError('Invalid body'));
   * });
   */
  getBody: <T>(validator: Validator<T>) => Promise<Result<T, AppError>>;

  /**
   * Gets a request header value by name.
   * Header names are case-insensitive.
   *
   * @param name - Header name (e.g., 'content-type', 'authorization')
   * @returns Header value or undefined if not present
   *
   * @example
   * const contentType = context.getHeader('content-type');
   * const authHeader = context.getHeader('authorization');
   */
  getHeader: (name: string) => string | undefined;
}
