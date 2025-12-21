import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import zod from 'zod';

export const idSchema = zod.string().min(1, 'ID must not be empty');

export function validId<T>(input: unknown): Result<T, AppError> {
  // biome-ignore lint: Required for generic branded type validation
  return validate(idSchema, input).map((result) => result as T);
}
