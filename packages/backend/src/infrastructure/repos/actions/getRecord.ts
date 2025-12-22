import type { Context } from '@backend/infrastructure/context';
import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import type { ExtraColumnsConfig } from '@backend/infrastructure/repos/domain/ExtraColumnsConfig';
import {
  createNotFoundError,
  type DBError,
} from '@backend/infrastructure/repos/errors/DBError';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors';

import { err, ok, type Result } from 'neverthrow';

export interface GetRecordDeps<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: IRelationalDatabaseAdapter;
  readonly validator: (data: unknown) => Result<T, AppError>;
  readonly extraColumns?: ExtraColumnsConfig<T>;
}

export interface GetRecordRequest<ID extends Id<string> = Id<string>> {
  readonly id: ID;
  readonly userId?: UserId;
}

/**
 * Gets a single record by ID from the database.
 * If userId is provided, the record must also match the userId (user-scoped query).
 */
export async function getRecord<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  _ctx: Context,
  request: GetRecordRequest<ID>,
  deps: GetRecordDeps<ID, T>,
): Promise<Result<T, DBError>> {
  const { adapter, validator, extraColumns } = deps;
  const { id, userId } = request;

  const where = userId !== undefined ? { id, userId } : { id };
  const result = await adapter.findUnique({ where });

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

  if (dataResult.value.length === 0) {
    return err(createNotFoundError());
  }

  return ok(dataResult.value[0]);
}
