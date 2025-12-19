import { validateRawDatabaseQuery } from '@backend/infrastructure/repos/domain/RawDatabaseQuery';
import { type AppError, internalError } from '@core/errors';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';

export type ExecuteTaskQueryDeps = Record<string, never>;

export interface ExecuteTaskQueryRequest<T> {
  readonly query: () => Promise<unknown>;
  readonly validator: Validator<T>;
}

/**
 * Generic query executor that validates and transforms database results.
 */
export async function executeTaskQuery<T>(
  _deps: ExecuteTaskQueryDeps,
  request: ExecuteTaskQueryRequest<T>,
): Promise<Result<T[], AppError>> {
  const { query, validator } = request;

  try {
    const results = await query();

    const validationResult = validateRawDatabaseQuery(results);
    if (validationResult.isErr()) {
      return err(validationResult.error);
    }

    const records: T[] = [];
    for (const result of validationResult.value) {
      const recordResult = validator({
        ...result.data,
        id: result.id,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      });

      if (recordResult.isErr()) {
        return err(recordResult.error);
      }
      records.push(recordResult.value);
    }

    return ok(records);
  } catch (error) {
    return err(
      internalError('Failed to execute query', {
        cause: error instanceof Error ? error : undefined,
        metadata: {},
      }),
    );
  }
}
