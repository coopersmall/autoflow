import type { ICacheAdapter } from '@backend/infrastructure/cache/domain/CacheAdapter';
import type { Context } from '@backend/infrastructure/context';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface SetCachedDeps<ID extends Id<string> = Id<string>> {
  readonly adapter: ICacheAdapter;
  readonly generateKey: (id: ID) => string;
}

export interface SetCachedRequest<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly id: ID;
  readonly item: T;
  readonly ttl?: number;
}

/**
 * Sets a value in the cache with optional TTL.
 */
export async function setCached<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: Context,
  request: SetCachedRequest<ID, T>,
  deps: SetCachedDeps<ID>,
): Promise<Result<void, AppError>> {
  const { adapter, generateKey } = deps;
  const { id, item, ttl = 3600 } = request;

  const key = generateKey(id);
  return adapter.set(key, item, { ttl });
}
