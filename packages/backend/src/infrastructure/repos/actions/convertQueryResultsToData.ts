/**
 * Converts raw database query results to validated domain entities.
 *
 * This function is a critical transformation step in the repository layer data flow:
 * 1. Parses ISO date strings from database to Date objects
 * 2. Spreads data property fields into the entity
 * 3. Merges extra column values into the entity (overriding JSONB values if present)
 * 4. Validates each result with the provided Zod validator
 * 5. Fails fast on the first validation error
 *
 * Data flow:
 * RawDatabaseQuery (snake_case, ISO strings) → Domain Entity (camelCase, Date objects)
 */
import type { ExtraColumnsConfig } from '@backend/infrastructure/repos/domain/ExtraColumnsConfig';
import type { RawDatabaseQuery } from '@backend/infrastructure/repos/domain/RawDatabaseQuery';
import { type AppError, badRequest } from '@core/errors';
import type { Validator } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';

/**
 * Converts and validates raw database results to domain entities.
 * Parses timestamps, spreads data fields, merges extra column values, and validates with Zod schemas.
 * @param data - Array of raw database records from query
 * @param validator - Zod validator function for domain entity validation
 * @param extraColumns - Optional configuration for extra columns to merge into entities
 * @returns Array of validated domain entities or error on first validation failure
 */
export function convertQueryResultsToData<T>(
  data: RawDatabaseQuery,
  validator: Validator<T>,
  extraColumns?: ExtraColumnsConfig<T>,
): Result<T[], AppError> {
  const items: T[] = [];
  for (const d of data) {
    let createdAt: Date;
    try {
      createdAt =
        d.created_at instanceof Date ? d.created_at : new Date(d.created_at);
    } catch {
      return err(badRequest('Invalid created_at date', { metadata: {} }));
    }
    let updatedAt: Date | undefined;
    if (d.updated_at) {
      try {
        updatedAt =
          d.updated_at instanceof Date ? d.updated_at : new Date(d.updated_at);
      } catch {
        return err(badRequest('Invalid updated_at date', { metadata: {} }));
      }
    }

    // Build base entity from standard fields + JSONB data
    const baseEntity: Record<string, unknown> = {
      id: d.id,
      createdAt,
      updatedAt,
      ...d.data,
    };

    // Merge extra column values (override JSONB values if present)
    if (extraColumns) {
      for (const [columnName, fieldName] of Object.entries(
        extraColumns.columnToField,
      )) {
        if (columnName in d) {
          baseEntity[fieldName] = d[columnName];
        }
      }
    }

    const validated = validator(baseEntity);

    if (validated.isErr()) {
      return err(validated.error);
    }
    items.push(validated.value);
  }

  return ok(items);
}
