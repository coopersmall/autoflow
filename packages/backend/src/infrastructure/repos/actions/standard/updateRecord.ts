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

export interface UpdateRecordContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: IRelationalDatabaseAdapter;
  readonly validator: (data: unknown) => Result<T, ValidationError>;
}

export interface UpdateRecordRequest<ID extends Id<string>, T> {
  readonly id: ID;
  readonly userId: UserId;
  readonly data: Partial<T>;
}

/**
 * Updates an existing user-scoped record in the database.
 */
export async function updateRecord<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: UpdateRecordContext<ID, T>,
  request: UpdateRecordRequest<ID, T>,
): Promise<Result<T, DBError>> {
  const { adapter, validator } = ctx;
  const { id, userId, data } = request;

  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...dataOnly
  } = data;

  const result = await adapter.update({
    where: {
      id,
      updatedAt: new Date(),
      userId,
    },
    data: dataOnly,
  });

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
