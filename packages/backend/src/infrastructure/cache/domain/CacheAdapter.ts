/**
 * Cache adapter interface.
 *
 * Defines the contract for cache adapters that handle key generation,
 * serialization, and cache operations. Adapters sit between cache classes
 * (SharedCache/StandardCache) and the underlying cache client.
 */
import type { AppError } from '@core/errors/AppError';
import type { Validator } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import type { ICacheClient } from './Cache';

/**
 * Configuration for cache operations.
 */
export interface CacheOptions {
  /**
   * Time-to-live in seconds. Defaults to 3600 (1 hour) if not specified.
   */
  ttl?: number;
}

/**
 * Adapter interface for cache operations.
 * Handles key generation, serialization, and client interaction.
 */
export interface ICacheAdapter {
  /**
   * Retrieves a typed value from cache.
   * @param key - Raw cache key (will be namespaced)
   * @param validator - Validation function for type checking
   * @returns Parsed and validated value, or error
   */
  get<T>(key: string, validator: Validator<T>): Promise<Result<T, AppError>>;

  /**
   * Stores a typed value in cache.
   * @param key - Raw cache key (will be namespaced)
   * @param value - Value to cache
   * @param options - Cache options (TTL, etc.)
   * @returns Success or error
   */
  set<T>(
    key: string,
    value: T,
    options?: CacheOptions,
  ): Promise<Result<void, AppError>>;

  /**
   * Deletes a value from cache.
   * @param key - Raw cache key (will be namespaced)
   * @returns Success or error
   */
  del(key: string): Promise<Result<void, AppError>>;

  /**
   * Returns the underlying cache client.
   * @returns Cache client instance
   */
  getClient(): ICacheClient;
}
