import type { ISharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface CreateItemDeps<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly repo: ISharedRepo<ID, T>;
  readonly cache?: ISharedCache<ID, T>;
  readonly serviceName: string;
  readonly newId: () => ID;
}

export interface CreateItemRequest<T> {
  readonly data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
}

/**
 * Creates a new item in the repo and optionally caches it.
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
  const { data } = request;

  const id = newId();
  const result = await repo.create(ctx, id, data);

  if (result.isErr()) {
    return err(result.error);
  }

  if (cache) {
    const setResult = await cache.set(ctx, id, result.value);
    if (setResult.isErr()) {
      logger.error('Failed to set cache after create', setResult.error, {
        correlationId: ctx.correlationId,
        id,
        service: serviceName,
      });
    }
  }

  return ok(result.value);
}
