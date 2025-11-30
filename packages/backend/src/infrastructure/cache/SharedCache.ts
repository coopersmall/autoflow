/**
 * Cache for globally accessible data without user scoping.
 *
 * SharedCache provides caching for data that is accessible to all users,
 * such as user profiles, system configuration, or public resources.
 * Uses the adapter pattern for abstraction and testability.
 *
 * Key Features:
 * - No user scoping - data is global
 * - Cache key format: `{namespace}/{id}`
 * - Supports cache-aside pattern with onMiss callback
 * - Automatic serialization/deserialization via adapter
 * - Type-safe with Zod validation
 * - Result types for error handling
 *
 * Architecture:
 * - Uses CacheAdapter for all cache operations
 * - Delegates key generation to generateCacheKey action
 * - Provides dependency injection for testing
 * - No direct client access - all ops through adapter
 *
 * Example Usage:
 * ```typescript
 * const usersCache = new SharedCache('users', {
 *   logger,
 *   adapter,
 *   validator: validUser,
 * });
 *
 * // Get with auto-cache on miss
 * const result = await usersCache.get('user-123', async (id) => {
 *   return await fetchUserFromDB(id);
 * });
 * ```
 */
import { generateCacheKey } from '@backend/infrastructure/cache/actions/generateCacheKey';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import { createCacheAdapter } from './adapters/CacheAdapter';
import { createCacheClientFactory } from './clients/CacheClientFactory';
import type { ICacheClientFactory } from './domain/Cache';
import type { ICacheAdapter } from './domain/CacheAdapter';

export type ISharedCache<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<SharedCache<ID, T>>;

/**
 * Context for SharedCache construction.
 */
export interface SharedCacheContext<T> {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  validator: Validator<T>;
}

/**
 * Cache class for globally accessible data.
 * Provides typed cache operations without user scoping.
 */
export class SharedCache<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  private readonly clientFactory: ICacheClientFactory;
  private adapter?: ICacheAdapter;
  /**
   * Creates a new SharedCache instance.
   * @param namespace - Cache namespace (e.g., 'users', 'config')
   * @param ctx - Cache context with logger, adapter, and validator
   * @param dependencies - Optional dependencies for testing
   */
  constructor(
    private readonly namespace: string,
    private readonly ctx: SharedCacheContext<T>,
    private readonly dependencies = {
      createCacheClientFactory,
      createCacheAdapter,
      generateCacheKey,
    },
  ) {
    this.clientFactory = this.dependencies.createCacheClientFactory(
      this.ctx.appConfig,
    );
  }

  /**
   * Retrieves a value from cache by ID.
   * Optionally executes onMiss callback and caches the result on cache miss.
   * @param id - Entity ID
   * @param onMiss - Optional callback to execute on cache miss
   * @returns Cached value or error
   */
  async get(
    id: ID,
    onMiss?: (id: ID) => Promise<Result<T, ErrorWithMetadata>>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    const key = this.generateKey(id);

    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    const result = await adapterResult.value.get<T>(key, this.ctx.validator);

    if (result.isErr() && onMiss) {
      const missResult = await onMiss(id);
      if (missResult.isErr()) {
        return err(missResult.error);
      }

      const setResult = await this.set(id, missResult.value);
      if (setResult.isErr()) {
        this.ctx.logger.error(
          'Cache set failed on cache miss',
          setResult.error,
          { id, key },
        );
      }

      return ok(missResult.value);
    }

    return result;
  }

  /**
   * Stores a value in cache.
   * @param id - Entity ID
   * @param item - Value to cache
   * @param ttl - Time-to-live in seconds (default: 3600)
   * @returns Success or error
   */
  async set(
    id: ID,
    item: T,
    ttl: number = 3600,
  ): Promise<Result<void, ErrorWithMetadata>> {
    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }
    const key = this.generateKey(id);
    return adapter.value.set(key, item, { ttl });
  }

  /**
   * Deletes a value from cache.
   * @param id - Entity ID
   * @returns Success or error
   */
  async del(id: ID): Promise<Result<void, ErrorWithMetadata>> {
    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }
    const key = this.generateKey(id);
    return adapter.value.del(key);
  }

  /**
   * Retrieves or creates the cache adapter.
   * @returns Cache adapter or error
   */
  private getAdapter(): Result<ICacheAdapter, ErrorWithMetadata> {
    if (this.adapter) {
      return ok(this.adapter);
    }

    const clientResult = this.clientFactory.getCacheClient('redis');
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const adapter = this.dependencies.createCacheAdapter({
      client: clientResult.value,
      logger: this.ctx.logger,
    });
    this.adapter = adapter;
    return ok(adapter);
  }

  /**
   * Generates cache key for this namespace and ID.
   * @param id - Entity ID
   * @returns Cache key in format `{namespace}/{id}`
   */
  private generateKey(id: ID): string {
    return this.dependencies.generateCacheKey(this.namespace, id);
  }
}
