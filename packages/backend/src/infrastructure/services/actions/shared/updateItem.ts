import type { ISharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface UpdateItemDeps<
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
  ctx: Context,
  request: UpdateItemRequest<ID, T>,
  deps: UpdateItemDeps<ID, T>,
): Promise<Result<T, AppError>> {
  const { repo, cache, logger, serviceName } = deps;
  const { id, data } = request;

  const result = await repo.update(ctx, id, data);

  if (result.isErr()) {
    return err(result.error);
  }

  if (cache) {
    const setResult = await cache.set(ctx, id, result.value);
    if (setResult.isErr()) {
      logger.error('Failed to set cache after update', setResult.error, {
        correlationId: ctx.correlationId,
        id,
        service: serviceName,
      });
    }
  }

  return ok(result.value);
}
