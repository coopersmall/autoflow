import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { AppError } from '@core/errors/AppError';
import { RedisClient as BunRedisClient } from 'bun';
import { err, ok, type Result } from 'neverthrow';
import type { ILockAdapter } from '../domain/Lock';
import { lockOperationError } from '../errors/lockErrors';
import extendLockScript from '../scripts/extendLock.lua' with { type: 'text' };
import releaseLockScript from '../scripts/releaseLock.lua' with {
  type: 'text',
};

export function createRedisLockClient(
  appConfig: IAppConfigurationService,
): ILockAdapter {
  const redis = new BunRedisClient(appConfig.redisUrl, {});
  return Object.freeze(new RedisLockClient(redis));
}

/**
 * Redis-based lock client using SET NX EX and Lua scripts.
 *
 * Lock acquisition uses: SET key holderId NX EX ttl
 * Lock release uses: Lua script to atomically check holder and delete
 * Lock extend uses: Lua script to atomically check holder and update TTL
 */
class RedisLockClient implements ILockAdapter {
  constructor(private readonly redis: BunRedisClient) {}

  async tryAcquire(
    key: string,
    holderId: string,
    ttlSeconds: number,
  ): Promise<Result<boolean, AppError>> {
    try {
      // SET key holderId NX EX ttl
      // NX = only set if not exists
      // EX = expire in seconds
      const result = await this.redis.send('SET', [
        key,
        holderId,
        'NX',
        'EX',
        ttlSeconds.toString(),
      ]);

      // SET with NX returns null if key already exists, "OK" if set
      return ok(result !== null);
    } catch (error) {
      return err(lockOperationError('tryAcquire', key, error));
    }
  }

  async release(
    key: string,
    holderId: string,
  ): Promise<Result<boolean, AppError>> {
    try {
      const result = await this.redis.send('EVAL', [
        releaseLockScript,
        '1', // number of keys
        key, // KEYS[1]
        holderId, // ARGV[1]
      ]);

      return ok(result === 1);
    } catch (error) {
      return err(lockOperationError('release', key, error));
    }
  }

  async extend(
    key: string,
    holderId: string,
    ttlSeconds: number,
  ): Promise<Result<boolean, AppError>> {
    try {
      const result = await this.redis.send('EVAL', [
        extendLockScript,
        '1',
        key,
        holderId,
        ttlSeconds.toString(),
      ]);

      return ok(result === 1);
    } catch (error) {
      return err(lockOperationError('extend', key, error));
    }
  }

  async isLocked(key: string): Promise<Result<boolean, AppError>> {
    try {
      const result = await this.redis.send('EXISTS', [key]);
      return ok(result === 1);
    } catch (error) {
      return err(lockOperationError('isLocked', key, error));
    }
  }
}
