import type { ZodError } from 'zod';
import { type AppError, createAppError, type ErrorOptions } from './AppError';

/**
 * Creates a BadRequest error (400).
 * Use for invalid input, malformed requests, or invalid state transitions.
 *
 * @param message - Human-readable error message
 * @param options - Optional cause and metadata
 * @returns AppError with BadRequest code
 *
 * @example
 * ```ts
 * return err(badRequest('Invalid task state transition', {
 *   metadata: { currentState: 'completed', attemptedAction: 'retry' }
 * }));
 * ```
 */
export function badRequest(message: string, options?: ErrorOptions): AppError {
  return createAppError(message, 'BadRequest', options);
}

/**
 * Creates an Unauthorized error (401).
 * Use for authentication failures or missing credentials.
 *
 * @param message - Human-readable error message
 * @param options - Optional cause and metadata
 * @returns AppError with Unauthorized code
 *
 * @example
 * ```ts
 * return err(unauthorized('JWT token expired', {
 *   metadata: { token: 'xyz...', expiredAt: date }
 * }));
 * ```
 */
export function unauthorized(
  message: string,
  options?: ErrorOptions,
): AppError {
  return createAppError(message, 'Unauthorized', options);
}

/**
 * Creates a Forbidden error (403).
 * Use for authorization failures when user is authenticated but lacks permissions.
 *
 * @param message - Human-readable error message
 * @param options - Optional cause and metadata
 * @returns AppError with Forbidden code
 *
 * @example
 * ```ts
 * return err(forbidden('Insufficient permissions', {
 *   metadata: { required: ['admin'], actual: ['user'] }
 * }));
 * ```
 */
export function forbidden(message: string, options?: ErrorOptions): AppError {
  return createAppError(message, 'Forbidden', options);
}

/**
 * Creates a NotFound error (404).
 * Use when a requested resource doesn't exist.
 *
 * @param message - Human-readable error message
 * @param options - Optional cause and metadata
 * @returns AppError with NotFound code
 *
 * @example
 * ```ts
 * return err(notFound('Task not found', {
 *   metadata: { taskId: 'task_123' }
 * }));
 * ```
 */
export function notFound(message: string, options?: ErrorOptions): AppError {
  return createAppError(message, 'NotFound', options);
}

/**
 * Creates a Timeout error (408).
 * Use when an operation times out.
 *
 * @param message - Human-readable error message
 * @param options - Optional cause and metadata
 * @returns AppError with Timeout code
 *
 * @example
 * ```ts
 * return err(timeout('Request timed out', {
 *   metadata: { timeoutMs: 5000, operation: 'fetchUser' }
 * }));
 * ```
 */
export function timeout(message: string, options?: ErrorOptions): AppError {
  return createAppError(message, 'Timeout', options);
}

/**
 * Creates a GatewayTimeout error (504).
 * Use when an upstream service times out.
 *
 * @param message - Human-readable error message
 * @param options - Optional cause and metadata
 * @returns AppError with GatewayTimeout code
 *
 * @example
 * ```ts
 * return err(gatewayTimeout('Upstream service timeout', {
 *   metadata: { service: 'polygon-api', timeoutMs: 10000 }
 * }));
 * ```
 */
export function gatewayTimeout(
  message: string,
  options?: ErrorOptions,
): AppError {
  return createAppError(message, 'GatewayTimeout', options);
}

/**
 * Creates an InternalServer error (500).
 * Use for unexpected errors, database failures, or unhandled exceptions.
 *
 * @param message - Human-readable error message
 * @param options - Optional cause and metadata
 * @returns AppError with InternalServer code
 *
 * @example
 * ```ts
 * return err(internalError('Database query failed', {
 *   cause: dbError,
 *   metadata: { query: 'SELECT...', table: 'tasks' }
 * }));
 * ```
 */
export function internalError(
  message: string,
  options?: ErrorOptions,
): AppError {
  return createAppError(message, 'InternalServer', options);
}

/**
 * Creates a TooManyRequests error (429).
 * Use for rate limiting.
 *
 * @param message - Human-readable error message
 * @param options - Optional cause and metadata
 * @returns AppError with TooManyRequests code
 *
 * @example
 * ```ts
 * return err(tooManyRequests('Rate limit exceeded', {
 *   metadata: { limit: 100, window: '1m', retryAfter: 60 }
 * }));
 * ```
 */
export function tooManyRequests(
  message: string,
  options?: ErrorOptions,
): AppError {
  return createAppError(message, 'TooManyRequests', options);
}

// ============================================================================
// Validation Error Factory (flexible signature)
// ============================================================================

/**
 * Creates a validation error (400) with flexible input.
 * Accepts either a custom message or a Zod error.
 *
 * @param messageOrZodError - Either a custom error message or ZodError instance
 * @param options - Optional cause and metadata
 * @returns AppError with BadRequest code and validation issues in metadata
 *
 * @example
 * ```ts
 * // With ZodError
 * const result = schema.safeParse(input);
 * if (!result.success) {
 *   return err(validationError(result.error));
 * }
 *
 * // With custom message
 * return err(validationError('Invalid email format', {
 *   metadata: { field: 'email', value: input.email }
 * }));
 * ```
 */
export function validationError(
  messageOrZodError: string | ZodError,
  options?: ErrorOptions,
): AppError {
  const isZodError = typeof messageOrZodError !== 'string';
  const message = isZodError ? 'Validation failed' : messageOrZodError;

  const metadata = isZodError
    ? { ...options?.metadata, issues: messageOrZodError.issues }
    : options?.metadata;

  const cause = isZodError ? messageOrZodError : options?.cause;

  return createAppError(message, 'BadRequest', {
    ...options,
    metadata,
    cause,
  });
}
