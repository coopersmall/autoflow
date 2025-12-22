import type { Context } from '@backend/infrastructure/context';
import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import type { ExtraColumnsConfig } from '@backend/infrastructure/repos/domain/ExtraColumnsConfig';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';

import { err, ok, type Result } from 'neverthrow';

export interface GetAllRecordsDeps<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: IRelationalDatabaseAdapter;
  readonly validator: (data: unknown) => Result<T, AppError>;
  readonly extraColumns?: ExtraColumnsConfig<T>;
}

export interface GetAllRecordsRequest {
  readonly userId?: UserId;
  readonly limit?: number;
}

/**
 * Gets all records from the database with optional limit.
 * If userId is provided, only records matching that userId are returned (user-scoped query).
 */
export async function getAllRecords<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  _ctx: Context,
  request: GetAllRecordsRequest | undefined,
  deps: GetAllRecordsDeps<ID, T>,
): Promise<Result<T[], AppError>> {
  const { adapter, validator, extraColumns } = deps;

  const where = request?.userId !== undefined ? { userId: request.userId } : {};
  const result = await adapter.findMany({
    where,
    limit: request?.limit,
  });

  if (result.isErr()) {
    return err(result.error);
  }

  const dataResult = convertQueryResultsToData(
    result.value,
    validator,
    extraColumns,
  );
  if (dataResult.isErr()) {
    return err(dataResult.error);
  }

  return ok(dataResult.value);
}
