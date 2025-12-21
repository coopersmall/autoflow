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
import {
  deleteCached,
  getCached,
  setCached,
} from '@backend/infrastructure/cache/actions/shared';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { createCachedGetter } from '@backend/infrastructure/utils/createCachedGetter';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { AppError } from '@core/errors/AppError';
import type { ExtractMethods } from '@core/types';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import { createCacheAdapter } from './adapters/CacheAdapter';
import { createCacheClientFactory } from './clients/CacheClientFactory';
import type { ICacheAdapter } from './domain/CacheAdapter';

export type ISharedCache<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<SharedCache<ID, T>>;

/**
 * Configuration for SharedCache construction.
 */
export interface SharedCacheConfig<T> {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  validator: Validator<T>;
}

interface SharedCacheDependencies {
  createCacheClientFactory: typeof createCacheClientFactory;
  createCacheAdapter: typeof createCacheAdapter;
  generateCacheKey: typeof generateCacheKey;
}

interface SharedCacheActions {
  getCached: typeof getCached;
  setCached: typeof setCached;
  deleteCached: typeof deleteCached;
}

/**
 * Cache class for globally accessible data.
 * Provides typed cache operations without user scoping.
 */
export class SharedCache<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  private readonly getAdapter: () => Result<ICacheAdapter, AppError>;

  /**
   * Creates a new SharedCache instance.
   * @param namespace - Cache namespace (e.g., 'users', 'config')
   * @param ctx - Cache context with logger, adapter, and validator
   * @param dependencies - Optional dependencies for testing
   * @param sharedCacheActions - Injectable actions for testing
   */
  constructor(
    private readonly namespace: string,
    private readonly ctx: SharedCacheConfig<T>,
    private readonly dependencies: SharedCacheDependencies = {
      createCacheClientFactory,
      createCacheAdapter,
      generateCacheKey,
    },
    private readonly sharedCacheActions: SharedCacheActions = {
      getCached,
      setCached,
      deleteCached,
    },
  ) {
    const factory = this.dependencies.createCacheClientFactory(
      this.ctx.appConfig,
    );

    this.getAdapter = createCachedGetter(() => {
      const clientResult = factory.getCacheClient('redis');
      if (clientResult.isErr()) {
        return err(clientResult.error);
      }

      const adapter = this.dependencies.createCacheAdapter({
        client: clientResult.value,
        logger: this.ctx.logger,
      });
      return ok(adapter);
    });
  }

  /**
   * Retrieves a value from cache by ID.
   * Optionally executes onMiss callback and caches the result on cache miss.
   * @param ctx - Request context
   * @param id - Entity ID
   * @param onMiss - Optional callback to execute on cache miss
   * @returns Cached value or error
   */
  async get(
    ctx: Context,
    id: ID,
    onMiss?: (ctx: Context, id: ID) => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.sharedCacheActions.getCached(
      ctx,
      {
        id,
        onMiss,
        setCached: this.set.bind(this),
      },
      {
        adapter: adapterResult.value,
        logger: this.ctx.logger,
        validator: this.ctx.validator,
        generateKey: this.generateKey.bind(this),
      },
    );
  }

  /**
   * Stores a value in cache.
   * @param ctx - Request context
   * @param id - Entity ID
   * @param item - Value to cache
   * @param ttl - Time-to-live in seconds (default: 3600)
   * @returns Success or error
   */
  async set(
    ctx: Context,
    id: ID,
    item: T,
    ttl: number = 3600,
  ): Promise<Result<void, AppError>> {
    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }

    return this.sharedCacheActions.setCached(
      ctx,
      { id, item, ttl },
      {
        adapter: adapter.value,
        generateKey: this.generateKey.bind(this),
      },
    );
  }

  /**
   * Deletes a value from cache.
   * @param ctx - Request context
   * @param id - Entity ID
   * @returns Success or error
   */
  async del(ctx: Context, id: ID): Promise<Result<void, AppError>> {
    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }

    return this.sharedCacheActions.deleteCached(
      ctx,
      { id },
      {
        adapter: adapter.value,
        generateKey: this.generateKey.bind(this),
      },
    );
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
