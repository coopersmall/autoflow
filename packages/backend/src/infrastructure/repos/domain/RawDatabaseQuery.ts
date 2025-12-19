/**
 * Schema definitions for raw database query results.
 *
 * RawDatabaseQuery defines the structure of data returned directly from the database
 * before validation and conversion to domain entities. This is the boundary between
 * snake_case database convention and camelCase domain convention.
 */

import type { AppError } from '@core/errors';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import zod from 'zod';

/**
 * Zod schema for a single database record.
 * Represents the raw structure with snake_case fields.
 * Note: Uses `.nullish()` for optional fields since PostgreSQL returns `null` for NULL values.
 */
const rawDatabaseEntrySchema = zod.object({
  id: zod.string(),
  created_at: zod.union([zod.string(), zod.date()]),
  updated_at: zod.union([zod.string(), zod.date()]).nullish(),
  user_id: zod.string().nullish(),
  data: zod.record(zod.unknown()),
});

/**
 * Zod schema for database query results.
 * Always returns an array of records, even for single-record queries.
 */
const rawDatabaseQuerySchema = zod.array(rawDatabaseEntrySchema);

/**
 * Type representing raw database query results.
 * Array of records with snake_case fields and string timestamps.
 */
export type RawDatabaseQuery = zod.infer<typeof rawDatabaseQuerySchema>;

/**
 * Validates database query results against the RawDatabaseQuery schema.
 * Ensures all records have required fields and correct types.
 * @param data - Raw data returned from database query
 * @returns Validated RawDatabaseQuery array or validation error
 */
export function validateRawDatabaseQuery(
  data: unknown,
): Result<RawDatabaseQuery, AppError> {
  return validate(rawDatabaseQuerySchema, data);
}
