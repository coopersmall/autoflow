/**
 * Core cache abstraction interfaces.
 *
 * Defines the contracts for cache factories and clients used throughout
 * the cache layer. These abstractions allow different cache implementations
 * (e.g., Redis, in-memory, mock) to be swapped without changing cache code.
 */
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import zod from 'zod';

/**
 * Supported cache client types.
 * Currently only 'redis' is supported.
 */
const cacheClients = zod.enum(['redis']);

/**
 * Type representing supported cache client types.
 * @see cacheClients
 */
export type CacheClientType = zod.infer<typeof cacheClients>;

/**
 * Factory interface for creating cache clients.
 * Used by cache classes to obtain client instances.
 */
export interface ICacheClientFactory {
  /**
   * Creates a cache client connection.
   * @returns Cache client or configuration error
   */
  getCacheClient(type: CacheClientType): Result<ICacheClient, AppError>;
}

/**
 * Cache client interface for key-value operations.
 * Supports get, set, and delete operations with optional TTL.
 */
export interface ICacheClient {
  /**
   * Retrieves a value from cache by key.
   * @param key - Cache key
   * @returns Cached value as string, or null if not found
   */
  get(key: string): Promise<string | null>;

  /**
   * Stores a value in cache with optional TTL.
   * @param key - Cache key
   * @param value - Value to store (as string)
   * @param duration - TTL in seconds (optional)
   */
  set(key: string, value: string, duration?: number): Promise<void>;

  /**
   * Deletes a value from cache.
   * @param key - Cache key to delete
   */
  del(key: string): Promise<void>;
}
