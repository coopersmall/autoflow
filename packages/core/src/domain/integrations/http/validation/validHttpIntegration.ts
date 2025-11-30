import {
  type HttpIntegration,
  httpIntegrationSchema,
} from '@core/domain/integrations/http/HttpIntegration.ts';
import type { ValidationError } from '@core/errors/ValidationError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';

export function validHttpIntegration(
  input: unknown,
): Result<HttpIntegration, ValidationError> {
  return validate(httpIntegrationSchema, input);
}
