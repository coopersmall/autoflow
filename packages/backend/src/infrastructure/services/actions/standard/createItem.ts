import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface CreateItemDeps<
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
  ctx: Context,
  request: CreateItemRequest<T>,
  deps: CreateItemDeps<ID, T>,
): Promise<Result<T, AppError>> {
  const { newId, repo, cache, logger, serviceName } = deps;
  const { userId, data } = request;

  const id = newId();
  const result = await repo.create(ctx, id, userId, data);

  if (result.isErr()) {
    return err(result.error);
  }

  if (cache) {
    const setResult = await cache.set(ctx, result.value, userId);
    if (setResult.isErr()) {
      logger.error('Failed to set cache after create', setResult.error, {
        correlationId: ctx.correlationId,
        id,
        userId,
        service: serviceName,
      });
    }
  }

  return ok(result.value);
}
