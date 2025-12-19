import type { Context } from '@backend/infrastructure/context';
import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface GetAllItemsDeps<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly repo: ISharedRepo<ID, T>;
}

/**
 * Gets all items from the repo.
 * Note: Cache is not used for 'all' operations.
 */
export async function getAllItems<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(ctx: Context, deps: GetAllItemsDeps<ID, T>): Promise<Result<T[], AppError>> {
  return deps.repo.all(ctx);
}
