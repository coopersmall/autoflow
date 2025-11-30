import type { ISharedRepo } from '@backend/infrastructure/repos/SharedRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export interface GetAllItemsContext<
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
>(ctx: GetAllItemsContext<ID, T>): Promise<Result<T[], ErrorWithMetadata>> {
  return ctx.repo.all();
}
