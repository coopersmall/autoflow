import type { ISharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';

export interface GetItemDeps<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly logger: ILogger;
  readonly repo: ISharedRepo<ID, T>;
  readonly cache?: ISharedCache<ID, T>;
  readonly serviceName: string;
}

export interface GetItemRequest<ID extends Id<string> = Id<string>> {
  readonly id: ID;
}

/**
 * Gets an item from cache or repo.
 * Implements cache-aside pattern: check cache first, fall back to repo.
 */
export async function getItem<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: Context,
  request: GetItemRequest<ID>,
  deps: GetItemDeps<ID, T>,
): Promise<Result<T, AppError>> {
  const { cache, repo, logger, serviceName } = deps;
  const { id } = request;

  if (cache) {
    const cached = await cache.get(ctx, id, (ctx, id) => repo.get(ctx, id));
    if (cached.isErr()) {
      logger.error('Failed to get from cache', cached.error, {
        correlationId: ctx.correlationId,
        id,
        service: serviceName,
      });
    } else if (cached.value !== undefined) {
      return ok(cached.value);
    }
  }

  return repo.get(ctx, id);
}
