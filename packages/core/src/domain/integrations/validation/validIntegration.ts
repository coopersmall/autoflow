import {
  type Integration,
  type IntegrationId,
  integrationSchema,
} from '@core/domain/integrations/Integration';
import { validId } from '@core/domain/validation/validId';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validIntegration(
  input: unknown,
): Result<Integration, AppError> {
  return validate(integrationSchema, input);
}

export function validIntegrationId(
  input: unknown,
): Result<IntegrationId, AppError> {
  return validId<IntegrationId>(input);
}
