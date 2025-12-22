import type { Context } from '@backend/infrastructure/context';
import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import { extractExtraColumnValues } from '@backend/infrastructure/repos/actions/extractExtraColumnValues';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import type { ExtraColumnsConfig } from '@backend/infrastructure/repos/domain/ExtraColumnsConfig';
import type { DBError } from '@backend/infrastructure/repos/errors/DBError';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors';

import { err, ok, type Result } from 'neverthrow';

export interface CreateRecordDeps<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: IRelationalDatabaseAdapter;
  readonly validator: (data: unknown) => Result<T, AppError>;
  readonly extraColumns?: ExtraColumnsConfig<T>;
}

export interface CreateRecordRequest<
  ID extends Id<string>,
  T extends Item<ID>,
> {
  readonly id: ID;
  readonly userId?: UserId;
  readonly data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
}

/**
 * Creates a new record in the database.
 * If userId is provided, the record is user-scoped.
 * Extracts extra column values from data and passes them to the adapter.
 */
export async function createRecord<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  _ctx: Context,
  request: CreateRecordRequest<ID, T>,
  deps: CreateRecordDeps<ID, T>,
): Promise<Result<T, DBError>> {
  const { adapter, validator, extraColumns } = deps;
  const { id, userId, data } = request;

  // Extract extra column values from data if configured
  const extraColumnValues = extractExtraColumnValues(data, extraColumns);

  const result = await adapter.create({
    id,
    userId,
    createdAt: new Date(),
    data,
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

  return ok(dataResult.value[0]);
}
