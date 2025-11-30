/**
 * Error factory functions and types for cache layer.
 * Provides standardized error creation for cache operations.
 */
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { NotFoundError } from '@core/errors/NotFoundError';
import type { ValidationError } from '@core/errors/ValidationError';

/**
 * Creates a generic cache error from unknown error source.
 * Wraps errors in ErrorWithMetadata with InternalServer code.
 * @param error - Unknown error from cache operation
 * @param metadata - Additional context metadata
 * @returns ErrorWithMetadata with cache error context
 */
export function createCacheError(
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  return new ErrorWithMetadata('Cache error', 'InternalServer', {
    error,
    ...metadata,
  });
}

/**
 * Creates a cache get operation error.
 * @param error - Original error from get operation
 * @param metadata - Context (key, id, etc.)
 * @returns ErrorWithMetadata with get error context
 */
export function createCacheGetError(
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  return new ErrorWithMetadata('Cache get error', 'InternalServer', {
    error,
    ...metadata,
  });
}

/**
 * Creates a cache set operation error.
 * @param error - Original error from set operation
 * @param metadata - Context (key, id, value, etc.)
 * @returns ErrorWithMetadata with set error context
 */
export function createCacheSetError(
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  return new ErrorWithMetadata('Cache set error', 'InternalServer', {
    error,
    ...metadata,
  });
}

/**
 * Creates a cache delete operation error.
 * @param error - Original error from delete operation
 * @param metadata - Context (key, id, etc.)
 * @returns ErrorWithMetadata with delete error context
 */
export function createCacheDeleteError(
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  return new ErrorWithMetadata('Cache delete error', 'InternalServer', {
    error,
    ...metadata,
  });
}

/**
 * Creates a cache miss error (key not found).
 * @param metadata - Context (key, id, etc.)
 * @returns ErrorWithMetadata with NotFound code
 */
export function createCacheMissError(
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  return new ErrorWithMetadata('Cache miss', 'NotFound', metadata);
}

/**
 * Creates a cache validation error.
 * @param error - Validation error details
 * @param metadata - Context (key, id, etc.)
 * @returns ErrorWithMetadata with validation context
 */
export function createCacheValidationError(
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  return new ErrorWithMetadata('Cache validation failed', 'InternalServer', {
    error,
    ...metadata,
  });
}

/**
 * Creates a cache serialization error.
 * @param error - Serialization error details
 * @param metadata - Context (key, value, etc.)
 * @returns ErrorWithMetadata with serialization context
 */
export function createCacheSerializationError(
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  return new ErrorWithMetadata('Cache serialization error', 'InternalServer', {
    error,
    ...metadata,
  });
}

/**
 * Creates a cache deserialization error.
 * @param error - Deserialization error details
 * @param metadata - Context (key, data, etc.)
 * @returns ErrorWithMetadata with deserialization context
 */
export function createCacheDeserializationError(
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  return new ErrorWithMetadata(
    'Cache deserialization error',
    'InternalServer',
    {
      error,
      ...metadata,
    },
  );
}

/**
 * Union type of all possible cache errors.
 * Used in Result<T, CacheError> return types throughout the cache layer.
 */
export type CacheError = ValidationError | NotFoundError | ErrorWithMetadata;
