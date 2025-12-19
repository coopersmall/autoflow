import type { IStandardCache } from '@backend/infrastructure/cache/StandardCache';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface DeleteItemDeps<
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
  ctx: Context,
  request: DeleteItemRequest<ID>,
  deps: DeleteItemDeps<ID, T>,
): Promise<Result<T, AppError>> {
  const { repo, cache, logger, serviceName } = deps;
  const { id, userId } = request;

  const result = await repo.delete(ctx, id, userId);

  if (result.isErr()) {
    return err(result.error);
  }

  if (cache) {
    const delResult = await cache.del(ctx, id, userId);
    if (delResult.isErr()) {
      logger.error('Failed to delete cache after delete', delResult.error, {
        correlationId: ctx.correlationId,
        id,
        userId,
        service: serviceName,
      });
    }
  }

  return ok(result.value);
}
