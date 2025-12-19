/**
 * Error factory functions and types for cache layer.
 * Provides standardized error creation for cache operations.
 */
import { type AppError, internalError, notFound } from '@core/errors';

/**
 * Creates a generic cache error from unknown error source.
 * Wraps errors in AppError with InternalServer code.
 * @param error - Unknown error from cache operation
 * @param metadata - Additional context metadata
 * @returns AppError with cache error context
 */
export function createCacheError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Cache error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

/**
 * Creates a cache get operation error.
 * @param error - Original error from get operation
 * @param metadata - Context (key, id, etc.)
 * @returns AppError with get error context
 */
export function createCacheGetError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Cache get error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

/**
 * Creates a cache set operation error.
 * @param error - Original error from set operation
 * @param metadata - Context (key, id, value, etc.)
 * @returns AppError with set error context
 */
export function createCacheSetError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Cache set error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

/**
 * Creates a cache delete operation error.
 * @param error - Original error from delete operation
 * @param metadata - Context (key, id, etc.)
 * @returns AppError with delete error context
 */
export function createCacheDeleteError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Cache delete error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

/**
 * Creates a cache miss error (key not found).
 * @param metadata - Context (key, id, etc.)
 * @returns AppError with NotFound code
 */
export function createCacheMissError(
  metadata?: Record<string, unknown>,
): AppError {
  return notFound('Cache miss', { metadata });
}

/**
 * Creates a cache validation error.
 * @param error - Validation error details
 * @param metadata - Context (key, id, etc.)
 * @returns AppError with validation context
 */
export function createCacheValidationError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Cache validation failed', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

/**
 * Creates a cache serialization error.
 * @param error - Serialization error details
 * @param metadata - Context (key, value, etc.)
 * @returns AppError with serialization context
 */
export function createCacheSerializationError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Cache serialization error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

/**
 * Creates a cache deserialization error.
 * @param error - Deserialization error details
 * @param metadata - Context (key, data, etc.)
 * @returns AppError with deserialization context
 */
export function createCacheDeserializationError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Cache deserialization error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

/**
 * Union type of all possible cache errors.
 * Used in Result<T, CacheError> return types throughout the cache layer.
 */
export type CacheError = AppError | AppError | AppError;
