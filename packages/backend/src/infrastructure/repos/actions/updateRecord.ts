import type { Context } from '@backend/infrastructure/context';
import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import { extractExtraColumnValues } from '@backend/infrastructure/repos/actions/extractExtraColumnValues';
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

export interface UpdateRecordDeps<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: IRelationalDatabaseAdapter;
  readonly validator: (data: unknown) => Result<T, AppError>;
  readonly extraColumns?: ExtraColumnsConfig<T>;
}

export interface UpdateRecordRequest<ID extends Id<string>, T> {
  readonly id: ID;
  readonly userId?: UserId;
  readonly data: Partial<T>;
}

/**
 * Updates an existing record in the database.
 * If userId is provided, the record must also match the userId (user-scoped query).
 * Extracts extra column values from data and passes them to the adapter.
 */
export async function updateRecord<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  _ctx: Context,
  request: UpdateRecordRequest<ID, T>,
  deps: UpdateRecordDeps<ID, T>,
): Promise<Result<T, DBError>> {
  const { adapter, validator, extraColumns } = deps;
  const { id, userId, data } = request;

  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...dataOnly
  } = data;

  // Extract extra column values from data if configured
  const extraColumnValues = extractExtraColumnValues(dataOnly, extraColumns);

  const where =
    userId !== undefined
      ? { id, updatedAt: new Date(), userId }
      : { id, updatedAt: new Date() };

  const result = await adapter.update({
    where,
    data: dataOnly,
    extraColumns: extraColumnValues,
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

  if (dataResult.value.length === 0) {
    return err(createNotFoundError());
  }

  return ok(dataResult.value[0]);
}
