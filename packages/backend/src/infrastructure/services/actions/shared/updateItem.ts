import type { ISharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface UpdateItemContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly repo: ISharedRepo<ID, T>;
  readonly cache?: ISharedCache<ID, T>;
  readonly serviceName: string;
}

export interface UpdateItemRequest<ID extends Id<string>, T> {
  readonly id: ID;
  readonly data: Partial<T>;
}

/**
 * Updates an item in the repo and updates the cache.
 */
export async function updateItem<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: UpdateItemContext<ID, T>,
  request: UpdateItemRequest<ID, T>,
): Promise<Result<T, ErrorWithMetadata>> {
  const { repo, cache, logger, serviceName } = ctx;
  const { id, data } = request;

  const result = await repo.update(id, data);

  if (result.isErr()) {
    return err(result.error);
  }

  if (cache) {
    const setResult = await cache.set(id, result.value);
    if (setResult.isErr()) {
      logger.error('Failed to set cache after update', setResult.error, {
        id,
        service: serviceName,
      });
    }
  }

  return ok(result.value);
}
