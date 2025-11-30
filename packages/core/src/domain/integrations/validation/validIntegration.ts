import {
  type Integration,
  type IntegrationId,
  integrationSchema,
} from '@core/domain/integrations/Integration.ts';
import { validId } from '@core/domain/validation/validId.ts';
import type { ValidationError } from '@core/errors/ValidationError.ts';
import { validate } from '@core/validation/validate.ts';
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
