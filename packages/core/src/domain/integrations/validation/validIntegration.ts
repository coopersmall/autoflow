import {
  type Integration,
  type IntegrationId,
  integrationSchema,
} from '@core/domain/integrations/Integration';
import { validId } from '@core/domain/validation/validId';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validIntegration(
  input: unknown,
): Result<Integration, ValidationError> {
  return validate(integrationSchema, input);
}

export function validIntegrationId(
  input: unknown,
): Result<IntegrationId, ValidationError> {
  return validId<IntegrationId>(input);
}
