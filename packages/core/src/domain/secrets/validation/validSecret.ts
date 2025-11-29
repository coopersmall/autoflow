import {
  type Secret,
  type SecretId,
  type StoredSecret,
  secretIdSchema,
  secretSchema,
  storedSecretSchema,
} from '@core/domain/secrets/Secret';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validSecret(input: unknown): Result<Secret, ValidationError> {
  return validate(secretSchema, input);
}

export function validStoredSecret(
  input: unknown,
): Result<StoredSecret, ValidationError> {
  return validate(storedSecretSchema, input);
}

export function validSecretId(
  input: unknown,
): Result<SecretId, ValidationError> {
  return validate(secretIdSchema, input);
}
