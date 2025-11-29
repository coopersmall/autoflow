/**
 * Error factory functions and types for repository layer.
 * Provides standardized error creation for database operations.
 */
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { NotFoundError } from '@core/errors/NotFoundError';
import type { ValidationError } from '@core/errors/ValidationError';

/**
 * Creates a generic database error from unknown error source.
 * Wraps errors in ErrorWithMetadata with InternalServer code.
 * @param error - Unknown error from database operation
 * @param metadata - Additional error context
 * @returns ErrorWithMetadata with database error context
 */
export function createDatabaseError(
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  const message = error instanceof Error ? error.message : 'Database error';
  const cause = error instanceof Error ? error : undefined;
  return new ErrorWithMetadata(message, 'InternalServer', {
    ...metadata,
    ...(cause ? { cause } : {}),
  });
}

/**
 * Creates a standardized not found error for missing records.
 * @returns NotFoundError with standard message
 */
export function createNotFoundError(): NotFoundError {
  return new NotFoundError('Record not found');
}

/**
 * Union type of all possible repository errors.
 * Used in Result<T, DBError> return types throughout the repository layer.
 */
export type DBError = ValidationError | NotFoundError | ErrorWithMetadata;
