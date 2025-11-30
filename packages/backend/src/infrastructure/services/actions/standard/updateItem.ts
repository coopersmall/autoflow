import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface UpdateItemContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly repo: IStandardRepo<ID, T>;
  readonly cache?: IStandardCache<ID, T>;
  readonly serviceName: string;
}

export interface UpdateItemRequest<ID extends Id<string>, T> {
  readonly id: ID;
  readonly userId: UserId;
  readonly data: Partial<T>;
}

/**
 * Updates a user-scoped item in the repo and updates the cache.
 */
export async function updateItem<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: UpdateItemContext<ID, T>,
  request: UpdateItemRequest<ID, T>,
): Promise<Result<T, ErrorWithMetadata>> {
  const { repo, cache, logger, serviceName } = ctx;
  const { id, userId, data } = request;

  const currentResult = await repo.get(id, userId);
  if (currentResult.isErr()) {
    return err(currentResult.error);
  }

  const current = currentResult.value;
  const merged = {
    ...current,
    ...data,
  };

  const result = await repo.update(id, userId, merged);
  if (result.isErr()) {
    return err(result.error);
  }

  if (cache) {
    const setResult = await cache.set(result.value, userId);
    if (setResult.isErr()) {
      logger.error('Failed to set cache after update', setResult.error, {
        id,
        userId,
        service: serviceName,
      });
    }
  }

  return ok(result.value);
}
