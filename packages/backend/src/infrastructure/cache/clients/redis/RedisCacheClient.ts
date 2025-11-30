import type { ICacheClient } from '@backend/infrastructure/cache/clients/CacheClient';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { RedisClient as BunRedisClient } from 'bun';

export function createRedisClient(appConfig: IAppConfigurationService) {
  const redis = new BunRedisClient(appConfig.redisUrl, {});
  return new RedisClient(redis);
}

class RedisClient implements ICacheClient {
  constructor(private readonly redis: BunRedisClient) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, duration?: number): Promise<void> {
    if (duration) {
      await this.redis.set(key, value, 'EX', duration);
    } else {
      await this.redis.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
