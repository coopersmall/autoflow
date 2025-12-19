import type { ICacheAdapter } from '@backend/infrastructure/cache/domain/CacheAdapter';
import type { Context } from '@backend/infrastructure/context';
import type { Id } from '@core/domain/Id';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface DeleteCachedDeps<ID extends Id<string> = Id<string>> {
  readonly adapter: ICacheAdapter;
  readonly generateKey: (id: ID) => string;
}

export interface DeleteCachedRequest<ID extends Id<string> = Id<string>> {
  readonly id: ID;
}

/**
 * Deletes a value from the cache.
 */
export async function deleteCached<ID extends Id<string> = Id<string>>(
  ctx: Context,
  request: DeleteCachedRequest<ID>,
  deps: DeleteCachedDeps<ID>,
): Promise<Result<void, AppError>> {
  const { adapter, generateKey } = deps;
  const { id } = request;

  const key = generateKey(id);
  return adapter.del(key);
}
