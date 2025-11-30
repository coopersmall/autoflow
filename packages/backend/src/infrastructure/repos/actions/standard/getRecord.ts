import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import {
  createNotFoundError,
  type DBError,
} from '@backend/infrastructure/repos/errors/DBError';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { ValidationError } from '@core/errors/ValidationError';
import { err, ok, type Result } from 'neverthrow';

export interface GetRecordContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: IRelationalDatabaseAdapter;
  readonly validator: (data: unknown) => Result<T, ValidationError>;
}

export interface GetRecordRequest<ID extends Id<string> = Id<string>> {
  readonly id: ID;
  readonly userId: UserId;
}

/**
 * Gets a single user-scoped record by ID from the database.
 */
export async function getRecord<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: GetRecordContext<ID, T>,
  request: GetRecordRequest<ID>,
): Promise<Result<T, DBError>> {
  const { adapter, validator } = ctx;
  const { id, userId } = request;

  const result = await adapter.findUnique({ where: { id, userId } });
  if (result.isErr()) {
    return err(result.error);
  }

  const dataResult = convertQueryResultsToData(result.value, validator);
  if (dataResult.isErr()) {
    return err(dataResult.error);
  }

  if (dataResult.value.length === 0) {
    return err(createNotFoundError());
  }

  return ok(dataResult.value[0]);
}
