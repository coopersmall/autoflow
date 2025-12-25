import type { Id } from '@autoflow/core';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { createRedisLockClient } from './clients/RedisLockClient';
import type {
  ILockAdapter,
  LockClientType,
  LockHandle,
  LockOptions,
} from './domain/Lock';
import { lockNotAcquiredError } from './errors/lockErrors';

export interface DistributedLockConfig {
  readonly logger: ILogger;
  readonly appConfig: IAppConfigurationService;
  /**
   * Lock provider type. Defaults to 'redis'.
   */
  readonly provider?: LockClientType;
  /**
   * Default TTL in seconds. Defaults to 300 (5 minutes).
   */
  readonly defaultTtl?: number;
}

export type IDistributedLock<ID extends Id<string> = Id<string>> = Readonly<{
  /**
   * Attempt to acquire a lock. Non-blocking - returns immediately.
   *
   * The context's correlationId is used as the holder ID by default,
   * ensuring request traceability without random UUID generation.
   *
   * @param ctx - Request context. The correlationId is used as the holder ID by default.
   * @param id - Lock identifier (combined with namespace to form key)
   * @param options - Lock options (TTL, holder ID override)
   * @returns LockHandle if acquired, null if already held
   */
  acquire(
    ctx: Context,
    id: ID,
    options?: LockOptions,
  ): Promise<Result<LockHandle | null, AppError>>;

  /**
   * Execute a function while holding a lock.
   * Automatically acquires and releases the lock.
   *
   * @param ctx - Request context
   * @param id - Lock identifier
   * @param fn - Function to execute while holding lock
   * @param options - Lock options
   * @returns Result of fn, or error if lock couldn't be acquired
   */
  withLock<T>(
    ctx: Context,
    id: ID,
    fn: () => Promise<Result<T, AppError>>,
    options?: LockOptions,
  ): Promise<Result<T, AppError>>;

  /**
   * Check if a lock is currently held.
   */
  isLocked(ctx: Context, id: ID): Promise<Result<boolean, AppError>>;
}>;

/**
 * Creates a distributed lock service.
 *
 * @param namespace - Namespace for lock keys (e.g., 'agent-continuation')
 * @param config - Lock configuration
 */
export function createDistributedLock<ID extends Id<string> = Id<string>>(
  namespace: string,
  config: DistributedLockConfig,
): IDistributedLock<ID> {
  const provider = config.provider ?? 'redis';
  const adapter = createLockAdapter(provider, config.appConfig);
  return Object.freeze(new DistributedLock<ID>(namespace, config, adapter));
}

function createLockAdapter(
  provider: LockClientType,
  appConfig: IAppConfigurationService,
): ILockAdapter {
  switch (provider) {
    case 'redis':
      return createRedisLockClient(appConfig);
    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

class DistributedLock<ID extends Id<string> = Id<string>>
  implements IDistributedLock<ID>
{
  private readonly defaultTtl: number;

  constructor(
    private readonly namespace: string,
    private readonly config: DistributedLockConfig,
    private readonly adapter: ILockAdapter,
  ) {
    this.defaultTtl = config.defaultTtl ?? 300;
  }

  async acquire(
    ctx: Context,
    id: ID,
    options?: LockOptions,
  ): Promise<Result<LockHandle | null, AppError>> {
    const key = this.generateKey(id);
    // Use correlationId as holder ID - ensures request traceability
    // CorrelationId is a branded string type, so we need to coerce it to string
    const holderId = options?.holderId ?? String(ctx.correlationId);
    const ttl = options?.ttl ?? this.defaultTtl;

    const acquireResult = await this.adapter.tryAcquire(key, holderId, ttl);
    if (acquireResult.isErr()) {
      return err(acquireResult.error);
    }

    if (!acquireResult.value) {
      return ok(null); // Lock not acquired
    }

    const handle: LockHandle = {
      key,
      holderId,
      expiresAt: Date.now() + ttl * 1000,
      release: () => this.adapter.release(key, holderId),
      extend: (newTtl: number) => this.adapter.extend(key, holderId, newTtl),
    };

    return ok(handle);
  }

  async withLock<T>(
    ctx: Context,
    id: ID,
    fn: () => Promise<Result<T, AppError>>,
    options?: LockOptions,
  ): Promise<Result<T, AppError>> {
    const handleResult = await this.acquire(ctx, id, options);
    if (handleResult.isErr()) {
      return err(handleResult.error);
    }

    const handle = handleResult.value;
    if (handle === null) {
      return err(lockNotAcquiredError(this.namespace, id));
    }

    try {
      return await fn();
    } finally {
      const releaseResult = await handle.release();
      if (releaseResult.isErr()) {
        this.config.logger.error(
          'Failed to release lock',
          releaseResult.error,
          {
            namespace: this.namespace,
            id,
          },
        );
      }
    }
  }

  async isLocked(ctx: Context, id: ID): Promise<Result<boolean, AppError>> {
    const key = this.generateKey(id);
    return this.adapter.isLocked(key);
  }

  private generateKey(id: string): string {
    return `lock:${this.namespace}:${id}`;
  }
}
