/**
 * Cache for user-scoped data.
 *
 * StandardCache provides caching for data that is scoped to individual users,
 * such as user integrations, secrets, or personal settings.
 * Uses the adapter pattern for abstraction and testability.
 *
 * Key Features:
 * - User scoping - each user has isolated cache entries
 * - Cache key format: `user/{userId}/{namespace}/{id}`
 * - Supports cache-aside pattern with onMiss callback
 * - Automatic serialization/deserialization via adapter
 * - Type-safe with Zod validation
 * - Result types for error handling
 *
 * Architecture:
 * - Uses CacheAdapter for all cache operations
 * - Delegates key generation to generateStandardCacheKey action
 * - Provides dependency injection for testing
 * - No direct client access - all ops through adapter
 *
 * Example Usage:
 * ```typescript
 * const integrationsCache = new StandardCache('integrations', {
 *   logger,
 *   adapter,
 *   validator: validIntegration,
 * });
 *
 * // Get with auto-cache on miss
 * const result = await integrationsCache.get(
 *   'integration-123' as IntegrationId,
 *   'user-456' as UserId,
 *   async (id, userId) => {
 *     return await fetchIntegrationFromDB(id, userId);
 *   }
 * );
 * ```
 */
import { generateCacheKey } from '@backend/infrastructure/cache/actions/generateCacheKey';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import { createCacheAdapter } from './adapters/CacheAdapter';
import { createCacheClientFactory } from './clients/CacheClientFactory';
import type { ICacheClientFactory } from './domain/Cache';
import type { ICacheAdapter } from './domain/CacheAdapter';

export type IStandardCache<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<StandardCache<ID, T>>;

/**
 * Context for StandardCache construction.
 */
export interface StandardCacheContext<T> {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  validator: Validator<T>;
}

/**
 * Cache class for user-scoped data.
 * Provides typed cache operations with user isolation.
 */
export class StandardCache<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  private readonly clientFactory: ICacheClientFactory;
  private adapter?: ICacheAdapter;
  /**
   * Creates a new StandardCache instance.
   * @param namespace - Cache namespace (e.g., 'integrations', 'secrets')
   * @param ctx - Cache context with logger, adapter, and validator
   * @param dependencies - Optional dependencies for testing
   */
  constructor(
    private readonly namespace: string,
    private readonly ctx: StandardCacheContext<T>,
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
   * Retrieves a value from cache by ID and user ID.
   * Optionally executes onMiss callback and caches the result on cache miss.
   * @param id - Entity ID
   * @param userId - User ID for scoping
   * @param onMiss - Optional callback to execute on cache miss
   * @returns Cached value or error
   */
  async get(
    id: ID,
    userId: UserId,
    onMiss?: (id: ID, userId: UserId) => Promise<Result<T, ErrorWithMetadata>>,
  ): Promise<Result<T, ErrorWithMetadata>> {
    const key = this.generateKey(id, userId);

    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }

    const result = await adapter.value.get<T>(key, this.ctx.validator);

    if (result.isErr() && onMiss) {
      const missResult = await onMiss(id, userId);
      if (missResult.isErr()) {
        return err(missResult.error);
      }

      const setResult = await this.set(missResult.value, userId);
      if (setResult.isErr()) {
        this.ctx.logger.error(
          'Cache set failed on cache miss',
          setResult.error,
          { id, userId, key },
        );
      }

      return ok(missResult.value);
    }

    return result;
  }

  /**
   * Stores a value in cache.
   * @param item - Value to cache (must have id property)
   * @param userId - User ID for scoping
   * @param ttl - Time-to-live in seconds (default: 3600)
   * @returns Success or error
   */
  async set(
    item: T,
    userId: UserId,
    ttl: number = 3600,
  ): Promise<Result<void, ErrorWithMetadata>> {
    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }
    const key = this.generateKey(item.id, userId);
    return adapter.value.set(key, item, { ttl });
  }

  /**
   * Deletes a value from cache.
   * @param id - Entity ID
   * @param userId - User ID for scoping
   * @returns Success or error
   */
  async del(id: ID, userId: UserId): Promise<Result<void, ErrorWithMetadata>> {
    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }
    const key = this.generateKey(id, userId);
    return adapter.value.del(key);
  }

  /**
   * Gets or creates the cache adapter.
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
      logger: this.ctx.logger,
      client: clientResult.value,
    });

    this.adapter = adapter;
    return ok(adapter);
  }

  /**
   * Generates cache key for this namespace, ID, and user ID.
   * @param id - Entity ID
   * @param userId - User ID
   * @returns Cache key in format `user/{userId}/{namespace}/{id}`
   */
  private generateKey(id: ID, userId: UserId): string {
    return this.dependencies.generateCacheKey(this.namespace, id, userId);
  }
}
