import {
  type Integration,
  type IntegrationId,
  integrationSchema,
} from '@core/domain/integrations/Integration.ts';
import { validId } from '@core/domain/validation/validId.ts';
import type { AppError } from '@core/errors/AppError.ts';
import { validate } from '@core/validation/validate.ts';
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
