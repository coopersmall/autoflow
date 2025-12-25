import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import type { z as zod } from 'zod';

/**
 * Validates output against a zod schema.
 * Used for output tool validation with retry support.
 */
export function validateOutput<T>(
  schema: zod.ZodSchema<T>,
  data: unknown,
): Result<T, AppError> {
  return validate(schema, data);
}
