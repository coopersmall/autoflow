import type { ICacheAdapter } from '@backend/infrastructure/cache/domain/CacheAdapter';
import type { Id } from '@core/domain/Id';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export interface DeleteCachedContext<ID extends Id<string> = Id<string>> {
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
  ctx: DeleteCachedContext<ID>,
  request: DeleteCachedRequest<ID>,
): Promise<Result<void, ErrorWithMetadata>> {
  const { adapter, generateKey } = ctx;
  const { id } = request;

  const key = generateKey(id);
  return adapter.del(key);
}
