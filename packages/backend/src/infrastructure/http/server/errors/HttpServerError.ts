/**
 * Error factory functions and types for HTTP server layer.
 * Provides standardized error creation for server operations.
 */
import { type AppError, internalError } from '@core/errors';

/**
 * Creates a generic HTTP server error from unknown error source.
 * Wraps errors in AppError with InternalServer code.
 * @param error - Unknown error from server operation
 * @param metadata - Additional context metadata (serverType, port, etc.)
 * @returns AppError with server error context
 */
export function createHttpServerError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  const message = error instanceof Error ? error.message : 'HTTP server error';
  const cause = error instanceof Error ? error : undefined;
  return internalError(message, { cause, metadata });
}

/**
 * Creates an HTTP server client error.
 * Used when client creation or initialization fails.
 * @param error - Original error from client operation
 * @param metadata - Context (clientType, etc.)
 * @returns AppError with client error context
 */
export function createHttpServerClientError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  const message =
    error instanceof Error ? error.message : 'HTTP server client error';
  const cause = error instanceof Error ? error : undefined;
  return internalError(message, { cause, metadata });
}

/**
 * Creates an HTTP server start error.
 * Used when server fails to start (e.g., port in use, permission denied).
 * @param error - Original error from start operation
 * @param metadata - Context (port, serverType, etc.)
 * @returns AppError with start error context
 */
export function createHttpServerStartError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  const message =
    error instanceof Error ? error.message : 'Failed to start HTTP server';
  const cause = error instanceof Error ? error : undefined;
  return internalError(message, { cause, metadata });
}

/**
 * Union type of all possible HTTP server errors.
 * Used in Result<T, HttpServerError> return types throughout the server layer.
 */
export type HttpServerError = AppError;
