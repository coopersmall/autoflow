/**
 * Error factory functions and types for repository layer.
 * Provides standardized error creation for database operations.
 */
import { type AppError, internalError, notFound } from '@core/errors';

/**
 * Creates a generic database error from unknown error source.
 * Wraps errors in AppError with InternalServer code.
 * @param error - Unknown error from database operation
 * @param metadata - Additional error context
 * @returns AppError with database error context
 */
export function createDatabaseError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  const message = error instanceof Error ? error.message : 'Database error';
  const cause = error instanceof Error ? error : undefined;
  return internalError(message, {
    cause,
    metadata,
  });
}

/**
 * Creates a standardized not found error for missing records.
 * @returns AppError with NotFound code and standard message
 */
export function createNotFoundError(): AppError {
  return notFound('Record not found');
}

/**
 * Union type of all possible repository errors.
 * Used in Result<T, DBError> return types throughout the repository layer.
 */
export type DBError = AppError;
