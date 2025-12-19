import type { Context } from '@backend/infrastructure/context';
import type { IStandardRepo } from '@backend/infrastructure/repos/StandardRepo';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface GetAllItemsDeps<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly repo: IStandardRepo<ID, T>;
}

export interface GetAllItemsRequest {
  readonly userId: UserId;
}

/**
 * Gets all user-scoped items from the repo.
 * Note: Cache is not used for 'all' operations.
 */
export async function getAllItems<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: Context,
  request: GetAllItemsRequest,
  deps: GetAllItemsDeps<ID, T>,
): Promise<Result<T[], AppError>> {
  return deps.repo.all(ctx, request.userId);
}
