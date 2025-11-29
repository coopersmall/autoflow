/**
 * Cache data serialization and deserialization utilities.
 *
 * Handles conversion between typed objects and cache-storable strings,
 * with error handling for serialization/deserialization failures.
 */
import {
  createCacheDeserializationError,
  createCacheSerializationError,
} from '@backend/cache/errors/CacheError';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';

/**
 * Serializes a typed value to a JSON string for cache storage.
 *
 * @param value - Value to serialize
 * @param metadata - Optional context for error reporting
 * @returns Serialized string or error
 */
export function serializeCacheData<T>(
  value: T,
  metadata?: Record<string, unknown>,
): Result<string, ErrorWithMetadata> {
  try {
    const serialized = JSON.stringify(value);
    return ok(serialized);
  } catch (error) {
    return err(createCacheSerializationError(error, metadata));
  }
}

/**
 * Deserializes and validates a JSON string from cache.
 *
 * @param data - JSON string from cache
 * @param validator - Zod or custom validator for type checking
 * @param metadata - Optional context for error reporting
 * @returns Parsed and validated value or error
 */
export function deserializeCacheData<T>(
  data: string,
  validator: Validator<T>,
  metadata?: Record<string, unknown>,
): Result<T, ErrorWithMetadata> {
  try {
    const parsed: unknown = JSON.parse(data, (_key, value: unknown) => {
      if (
        typeof value === 'string' &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        return new Date(value);
      }
      return value;
    });
    const validated = validator(parsed);
    if (validated.isErr()) {
      return err(validated.error);
    }
    return ok(validated.value);
  } catch (error) {
    return err(createCacheDeserializationError(error, metadata));
  }
}

/**
 * Converts raw cache data (string | null) to a typed value.
 * Handles cache misses (null) and deserialization/validation.
 *
 * @param data - Raw data from cache client (string | null)
 * @param validator - Validator for type checking
 * @param metadata - Optional context for error reporting
 * @returns Typed value, null for cache miss, or error
 */
export function convertCacheData<T>(
  data: string | null,
  validator: Validator<T>,
  metadata?: Record<string, unknown>,
): Result<T | null, ErrorWithMetadata> {
  if (data === null) {
    return ok(null);
  }
  return deserializeCacheData(data, validator, metadata);
}
