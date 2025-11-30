import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface DeleteItemContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly repo: IStandardRepo<ID, T>;
  readonly cache?: IStandardCache<ID, T>;
  readonly serviceName: string;
}

export interface DeleteItemRequest<ID extends Id<string> = Id<string>> {
  readonly id: ID;
  readonly userId: UserId;
}

/**
 * Deletes a user-scoped item from the repo and removes it from cache.
 */
export async function deleteItem<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: DeleteItemContext<ID, T>,
  request: DeleteItemRequest<ID>,
): Promise<Result<T, ErrorWithMetadata>> {
  const { repo, cache, logger, serviceName } = ctx;
  const { id, userId } = request;

  const result = await repo.delete(id, userId);

  if (result.isErr()) {
    return err(result.error);
  }

  if (cache) {
    const delResult = await cache.del(id, userId);
    if (delResult.isErr()) {
      logger.error('Failed to delete cache after delete', delResult.error, {
        id,
        userId,
        service: serviceName,
      });
    }
  }

  return ok(result.value);
}
