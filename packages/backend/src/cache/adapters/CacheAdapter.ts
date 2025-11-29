/**
 * Cache adapter implementation.
 *
 * This adapter provides abstraction between cache classes (SharedCache/StandardCache)
 * and the underlying cache client (Redis). Handles serialization, deserialization,
 * validation, and error management.
 *
 * Responsibilities:
 * - Serialize typed values to JSON strings for storage
 * - Deserialize and validate JSON strings from cache
 * - Handle cache misses (null) vs errors
 * - Wrap client errors in standardized ErrorWithMetadata
 * - Provide clean interface for cache operations
 *
 * Architecture:
 * - Uses ICacheClient for storage operations
 * - Uses action functions for data conversion
 * - Returns Result types for error handling
 * - No business logic - pure adapter pattern
 */
import {
  convertCacheData,
  serializeCacheData,
} from '@backend/cache/actions/convertCacheData';
import type { ICacheClient } from '@backend/cache/domain/Cache';
import type {
  CacheOptions,
  ICacheAdapter,
} from '@backend/cache/domain/CacheAdapter';
import {
  createCacheDeleteError,
  createCacheGetError,
  createCacheMissError,
  createCacheSetError,
} from '@backend/cache/errors/CacheError';
import type { ILogger } from '@backend/logger/Logger';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';

/**
 * Factory function for creating CacheAdapter instances.
 * @param client - Cache client implementation (Redis, etc.)
 * @param logger - Logger instance for error logging
 * @returns Configured cache adapter instance
 */
export function createCacheAdapter({
  client,
  logger,
}: {
  client: ICacheClient;
  logger: ILogger;
}): ICacheAdapter {
  return new CacheAdapter(client, logger);
}

/**
 * Concrete implementation of cache adapter.
 * Provides typed cache operations with serialization and validation.
 */
class CacheAdapter implements ICacheAdapter {
  /**
   * Creates a new cache adapter instance.
   * @param client - Cache client for storage operations
   * @param logger - Logger for error reporting
   */
  constructor(
    private readonly client: ICacheClient,
    private readonly logger: ILogger,
  ) {}

  /**
   * Retrieves and validates a typed value from cache.
   * @param key - Cache key
   * @param validator - Validation function for type checking
   * @returns Validated value or error
   */
  async get<T>(
    key: string,
    validator: Validator<T>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    try {
      const data = await this.client.get(key);

      if (data === null) {
        return err(createCacheMissError({ key }));
      }

      const result = convertCacheData(data, validator, { key });

      if (result.isErr()) {
        this.logger.error('Cache data conversion failed', result.error, {
          key,
        });
        return err(result.error);
      }

      if (result.value === null) {
        return err(createCacheMissError({ key }));
      }

      return ok(result.value);
    } catch (error) {
      const cacheError = createCacheGetError(error, { key });
      this.logger.error('Cache get failed', cacheError, { key });
      return err(cacheError);
    }
  }

  /**
   * Stores a typed value in cache with optional TTL.
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Cache options (TTL, etc.)
   * @returns Success or error
   */
  async set<T>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<Result<void, ErrorWithMetadata>> {
    try {
      const serialized = serializeCacheData(value, { key });

      if (serialized.isErr()) {
        this.logger.error('Cache serialization failed', serialized.error, {
          key,
        });
        return err(serialized.error);
      }

      const ttl = options?.ttl ?? 3600;
      await this.client.set(key, serialized.value, ttl);

      return ok(undefined);
    } catch (error) {
      const cacheError = createCacheSetError(error, { key });
      this.logger.error('Cache set failed', cacheError, { key });
      return err(cacheError);
    }
  }

  /**
   * Deletes a value from cache.
   * @param key - Cache key to delete
   * @returns Success or error
   */
  async del(key: string): Promise<Result<void, ErrorWithMetadata>> {
    try {
      await this.client.del(key);
      return ok(undefined);
    } catch (error) {
      const cacheError = createCacheDeleteError(error, { key });
      this.logger.error('Cache delete failed', cacheError, { key });
      return err(cacheError);
    }
  }

  /**
   * Returns the underlying cache client.
   * Allows direct client access when needed for advanced operations.
   * @returns Cache client instance
   */
  getClient(): ICacheClient {
    return this.client;
  }
}
