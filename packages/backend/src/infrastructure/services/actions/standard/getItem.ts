import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { ok, type Result } from 'neverthrow';

export interface GetItemContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly repo: IStandardRepo<ID, T>;
  readonly cache?: IStandardCache<ID, T>;
  readonly serviceName: string;
}

export interface GetItemRequest<ID extends Id<string> = Id<string>> {
  readonly id: ID;
  readonly userId: UserId;
}

/**
 * Gets a user-scoped item from cache or repo.
 * Implements cache-aside pattern with user scoping.
 */
export async function getItem<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: GetItemContext<ID, T>,
  request: GetItemRequest<ID>,
): Promise<Result<T, ErrorWithMetadata>> {
  const { cache, repo, logger, serviceName } = ctx;
  const { id, userId } = request;

  if (cache) {
    const cached = await cache.get(id, userId, (id, userId) =>
      repo.get(id, userId),
    );
    if (cached.isErr()) {
      logger.error('Failed to get from cache', cached.error, {
        id,
        userId,
        service: serviceName,
      });
    } else {
      return ok(cached.value);
    }
  }

  return repo.get(id, userId);
}
