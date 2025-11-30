import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface CreateItemContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly repo: IStandardRepo<ID, T>;
  readonly cache?: IStandardCache<ID, T>;
  readonly serviceName: string;
  readonly newId: () => ID;
}

export interface CreateItemRequest<T> {
  readonly userId: UserId;
  readonly data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
}

/**
 * Creates a new user-scoped item in the repo and optionally caches it.
 */
export async function createItem<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: CreateItemContext<ID, T>,
  request: CreateItemRequest<T>,
): Promise<Result<T, ErrorWithMetadata>> {
  const { newId, repo, cache, logger, serviceName } = ctx;
  const { userId, data } = request;

  const id = newId();
  const result = await repo.create(id, userId, data);

  if (result.isErr()) {
    return err(result.error);
  }

  if (cache) {
    const setResult = await cache.set(result.value, userId);
    if (setResult.isErr()) {
      logger.error('Failed to set cache after create', setResult.error, {
        id,
        userId,
        service: serviceName,
      });
    }
  }

  return ok(result.value);
}
