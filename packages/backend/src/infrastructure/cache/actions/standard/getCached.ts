import type { ICacheAdapter } from '@backend/infrastructure/cache/domain/CacheAdapter';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';

export interface GetCachedDeps<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: ICacheAdapter;
  readonly logger: ILogger;
  readonly validator: Validator<T>;
  readonly generateKey: (id: ID, userId: UserId) => string;
}

export interface GetCachedRequest<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly id: ID;
  readonly userId: UserId;
  readonly onMiss?: (
    ctx: Context,
    id: ID,
    userId: UserId,
  ) => Promise<Result<T, AppError>>;
  readonly setCached: (
    ctx: Context,
    item: T,
    userId: UserId,
    ttl?: number,
  ) => Promise<Result<void, AppError>>;
}

/**
 * Gets a cached value by ID and userId with optional cache-miss fallback.
 * If value is not cached and onMiss is provided, executes onMiss,
 * caches the result, and returns it.
 */
export async function getCached<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: Context,
  request: GetCachedRequest<ID, T>,
  deps: GetCachedDeps<ID, T>,
): Promise<Result<T, AppError>> {
  const { adapter, logger, validator, generateKey } = deps;
  const { id, userId, onMiss, setCached } = request;

  const key = generateKey(id, userId);

  const result = await adapter.get<T>(key, validator);

  // Cache miss with onMiss callback
  if (result.isErr() && onMiss) {
    const missResult = await onMiss(ctx, id, userId);
    if (missResult.isErr()) {
      return err(missResult.error);
    }

    // Try to cache the result
    const setResult = await setCached(ctx, missResult.value, userId);
    if (setResult.isErr()) {
      logger.error('Cache set failed on cache miss', setResult.error, {
        correlationId: ctx.correlationId,
        id,
        userId,
        key,
      });
    }

    return ok(missResult.value);
  }

  return result;
}
