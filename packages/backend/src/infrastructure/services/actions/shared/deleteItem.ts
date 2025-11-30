import type { ISharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface DeleteItemContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly repo: ISharedRepo<ID, T>;
  readonly cache?: ISharedCache<ID, T>;
  readonly serviceName: string;
}

export interface DeleteItemRequest<ID extends Id<string> = Id<string>> {
  readonly id: ID;
}

/**
 * Deletes an item from the repo and removes it from cache.
 */
export async function deleteItem<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: DeleteItemContext<ID, T>,
  request: DeleteItemRequest<ID>,
): Promise<Result<T, ErrorWithMetadata>> {
  const { repo, cache, logger, serviceName } = ctx;
  const { id } = request;

  const result = await repo.delete(id);

  if (result.isErr()) {
    return err(result.error);
  }

  if (cache) {
    const delResult = await cache.del(id);
    if (delResult.isErr()) {
      logger.error('Failed to delete cache after delete', delResult.error, {
        id,
        service: serviceName,
      });
    }
  }

  return ok(result.value);
}
