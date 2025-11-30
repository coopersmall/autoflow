import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';

import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ValidationError } from '@core/errors/ValidationError';
import { err, ok, type Result } from 'neverthrow';

export interface GetAllRecordsContext<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  readonly adapter: IRelationalDatabaseAdapter;
  readonly validator: (data: unknown) => Result<T, ValidationError>;
}

export interface GetAllRecordsRequest {
  readonly limit?: number;
}

/**
 * Gets all records from the database with optional limit.
 */
export async function getAllRecords<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
>(
  ctx: GetAllRecordsContext<ID, T>,
  request?: GetAllRecordsRequest,
): Promise<Result<T[], ErrorWithMetadata>> {
  const { adapter, validator } = ctx;

  const result = await adapter.findMany({
    where: {},
    limit: request?.limit,
  });

  if (result.isErr()) {
    return err(result.error);
  }

  const dataResult = convertQueryResultsToData(result.value, validator);
  if (dataResult.isErr()) {
    return err(dataResult.error);
  }

  return ok(dataResult.value);
}
