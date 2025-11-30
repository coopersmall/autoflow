import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { createRedisClient } from './redis/RedisCacheClient.ts';

export interface ICacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, duration?: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface CacheClients {
  redis: ICacheClient;
}

export function getCacheClients(
  appConfig: IAppConfigurationService,
): CacheClients {
  const redis = createRedisClient(appConfig);
  return { redis };
}
