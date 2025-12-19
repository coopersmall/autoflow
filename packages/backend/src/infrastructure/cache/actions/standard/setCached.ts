import type { ICacheAdapter } from '@backend/infrastructure/cache/domain/CacheAdapter';
import type { Context } from '@backend/infrastructure/context';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface SetCachedDeps<ID extends Id<string> = Id<string>> {
  readonly adapter: ICacheAdapter;
  readonly generateKey: (id: ID, userId: UserId) => string;
}

export interface SetCachedRequest<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly item: T;
  readonly userId: UserId;
  readonly ttl?: number;
}

/**
 * Sets a value in the cache with userId scoping and optional TTL.
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
  const { item, userId, ttl = 3600 } = request;

  // Item.id is always of type ID due to the type constraint T extends Item<ID>
  const itemId: ID = item.id;
  const key = generateKey(itemId, userId);
  return adapter.set(key, item, { ttl });
}
