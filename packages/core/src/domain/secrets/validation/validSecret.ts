import {
  type Secret,
  type SecretId,
  type StoredSecret,
  secretIdSchema,
  secretSchema,
  storedSecretSchema,
} from '@core/domain/secrets/Secret';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validSecret(input: unknown): Result<Secret, AppError> {
  return validate(secretSchema, input);
}

export function validStoredSecret(
  input: unknown,
): Result<StoredSecret, AppError> {
  return validate(storedSecretSchema, input);
}

export function validSecretId(input: unknown): Result<SecretId, AppError> {
  return validate(secretIdSchema, input);
}
