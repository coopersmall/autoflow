/**
 * Factory for creating cache client instances.
 *
 * Manages instantiation of cache clients (Redis, etc.) with proper configuration
 * and error handling. Returns Result types to handle configuration errors gracefully.
 *
 * Architecture:
 * - Validates configuration before creating clients
 * - Returns Result types for error handling
 * - Supports multiple client types (currently Redis)
 * - Provides clean interface for dependency injection
 */
import { createRedisClient } from '@backend/cache/clients/redis/RedisCacheClient';
import type {
  CacheClientType,
  ICacheClient,
  ICacheClientFactory,
} from '@backend/cache/domain/Cache';
import { createCacheError } from '@backend/cache/errors/CacheError';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

/**
 * Factory function for creating CacheClientFactory instances.
 * @param appConfig - Application configuration service
 * @returns Configured cache client factory
 */
export function createCacheClientFactory(
  appConfig: IAppConfigurationService,
): ICacheClientFactory {
  return new CacheClientFactory(appConfig);
}

/**
 * Concrete implementation of cache client factory.
 * Creates and configures cache client instances.
 */
class CacheClientFactory implements ICacheClientFactory {
  /**
   * Creates a new cache client factory.
   * @param appConfig - Application configuration service
   */
  constructor(private readonly appConfig: IAppConfigurationService) {}

  /**
   * Creates a cache client instance.
   * Currently supports Redis only.
   * @returns Cache client or configuration error
   */
  getCacheClient(
    type: CacheClientType,
  ): Result<ICacheClient, ErrorWithMetadata> {
    switch (type) {
      case 'redis':
        return this.getRedisClient();
      default:
        return err(
          createCacheError(new Error('Unsupported cache client type'), {
            type,
          }),
        );
    }
  }

  private getRedisClient(): Result<ICacheClient, ErrorWithMetadata> {
    const redisUrl = this.appConfig.redisUrl;

    if (!redisUrl) {
      return err(
        createCacheError(new Error('Redis URL not configured'), {
          configKey: 'redisUrl',
        }),
      );
    }

    try {
      const client = createRedisClient(this.appConfig);
      return ok(client);
    } catch (error) {
      return err(
        createCacheError(error, {
          message: 'Failed to create Redis client',
          redisUrl,
        }),
      );
    }
  }
}
