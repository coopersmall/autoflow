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
import {
  deleteCached,
  getCached,
  setCached,
} from '@backend/infrastructure/cache/actions/standard';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { createCachedGetter } from '@backend/infrastructure/utils/createCachedGetter';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { ExtractMethods } from '@core/types';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import { createCacheAdapter } from './adapters/CacheAdapter';
import { createCacheClientFactory } from './clients/CacheClientFactory';
import type { ICacheAdapter } from './domain/CacheAdapter';

export type IStandardCache<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<StandardCache<ID, T>>;

/**
 * Configuration for StandardCache construction.
 */
export interface StandardCacheConfig<T> {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  validator: Validator<T>;
}

interface StandardCacheDependencies {
  createCacheClientFactory: typeof createCacheClientFactory;
  createCacheAdapter: typeof createCacheAdapter;
  generateCacheKey: typeof generateCacheKey;
}

interface StandardCacheActions {
  getCached: typeof getCached;
  setCached: typeof setCached;
  deleteCached: typeof deleteCached;
}

/**
 * Cache class for user-scoped data.
 * Provides typed cache operations with user isolation.
 */
export class StandardCache<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  private readonly getAdapter: () => Result<ICacheAdapter, AppError>;

  /**
   * Creates a new StandardCache instance.
   * @param namespace - Cache namespace (e.g., 'integrations', 'secrets')
   * @param ctx - Cache context with logger, adapter, and validator
   * @param dependencies - Optional dependencies for testing
   * @param standardCacheActions - Injectable actions for testing
   */
  constructor(
    private readonly namespace: string,
    private readonly ctx: StandardCacheConfig<T>,
    private readonly dependencies: StandardCacheDependencies = {
      createCacheClientFactory,
      createCacheAdapter,
      generateCacheKey,
    },
    private readonly standardCacheActions: StandardCacheActions = {
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
   * Retrieves a value from cache by ID and user ID.
   * Optionally executes onMiss callback and caches the result on cache miss.
   * @param ctx - Request context
   * @param id - Entity ID
   * @param userId - User ID for scoping
   * @param onMiss - Optional callback to execute on cache miss
   * @returns Cached value or error
   */
  async get(
    ctx: Context,
    id: ID,
    userId: UserId,
    onMiss?: (
      ctx: Context,
      id: ID,
      userId: UserId,
    ) => Promise<Result<T, AppError>>,
  ): Promise<Result<T, AppError>> {
    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }

    return this.standardCacheActions.getCached(
      ctx,
      {
        id,
        userId,
        onMiss,
        setCached: this.set.bind(this),
      },
      {
        adapter: adapter.value,
        logger: this.ctx.logger,
        validator: this.ctx.validator,
        generateKey: this.generateKey.bind(this),
      },
    );
  }

  /**
   * Stores a value in cache.
   * @param ctx - Request context
   * @param item - Value to cache (must have id property)
   * @param userId - User ID for scoping
   * @param ttl - Time-to-live in seconds (default: 3600)
   * @returns Success or error
   */
  async set(
    ctx: Context,
    item: T,
    userId: UserId,
    ttl: number = 3600,
  ): Promise<Result<void, AppError>> {
    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }

    return this.standardCacheActions.setCached(
      ctx,
      { item, userId, ttl },
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
   * @param userId - User ID for scoping
   * @returns Success or error
   */
  async del(
    ctx: Context,
    id: ID,
    userId: UserId,
  ): Promise<Result<void, AppError>> {
    const adapter = this.getAdapter();
    if (adapter.isErr()) {
      return err(adapter.error);
    }

    return this.standardCacheActions.deleteCached(
      ctx,
      { id, userId },
      {
        adapter: adapter.value,
        generateKey: this.generateKey.bind(this),
      },
    );
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
