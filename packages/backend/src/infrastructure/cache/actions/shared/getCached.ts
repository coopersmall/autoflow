import type { ICacheAdapter } from '@backend/infrastructure/cache/domain/CacheAdapter';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';

export interface GetCachedContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: ICacheAdapter;
  readonly logger: ILogger;
  readonly validator: Validator<T>;
  readonly generateKey: (id: ID) => string;
}

export interface GetCachedRequest<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly id: ID;
  readonly onMiss?: (id: ID) => Promise<Result<T, ErrorWithMetadata>>;
  readonly setCached: (
    id: ID,
    item: T,
    ttl?: number,
  ) => Promise<Result<void, ErrorWithMetadata>>;
}

/**
 * Gets a cached value by ID with optional cache-miss fallback.
 * If value is not cached and onMiss is provided, executes onMiss,
 * caches the result, and returns it.
 */
export async function getCached<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: GetCachedContext<ID, T>,
  request: GetCachedRequest<ID, T>,
): Promise<Result<T, ErrorWithMetadata>> {
  const { adapter, logger, validator, generateKey } = ctx;
  const { id, onMiss, setCached } = request;

  const key = generateKey(id);

  const result = await adapter.get<T>(key, validator);

  // Cache miss with onMiss callback
  if (result.isErr() && onMiss) {
    const missResult = await onMiss(id);
    if (missResult.isErr()) {
      return err(missResult.error);
    }

    // Try to cache the result
    const setResult = await setCached(id, missResult.value);
    if (setResult.isErr()) {
      logger.error('Cache set failed on cache miss', setResult.error, {
        id,
        key,
      });
    }

    return ok(missResult.value);
  }

  return result;
}
