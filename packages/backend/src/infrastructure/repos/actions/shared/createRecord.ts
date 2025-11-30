import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import type { DBError } from '@backend/infrastructure/repos/errors/DBError';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ValidationError } from '@core/errors/ValidationError';
import { err, ok, type Result } from 'neverthrow';

export interface CreateRecordContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: IRelationalDatabaseAdapter;
  readonly validator: (data: unknown) => Result<T, ValidationError>;
}

export interface CreateRecordRequest<
  ID extends Id<string>,
  T extends Item<ID>,
> {
  readonly id: ID;
  readonly data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
}

/**
 * Creates a new record in the database.
 */
export async function createRecord<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: CreateRecordContext<ID, T>,
  request: CreateRecordRequest<ID, T>,
): Promise<Result<T, DBError>> {
  const { adapter, validator } = ctx;
  const { id, data } = request;

  const result = await adapter.create({
    id,
    createdAt: new Date(),
    data,
  });

  if (result.isErr()) {
    return err(result.error);
  }

  const dataResult = convertQueryResultsToData(result.value, validator);
  if (dataResult.isErr()) {
    return err(dataResult.error);
  }

  return ok(dataResult.value[0]);
}
