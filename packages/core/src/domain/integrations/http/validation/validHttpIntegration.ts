import {
  type HttpIntegration,
  httpIntegrationSchema,
} from '@core/domain/integrations/http/HttpIntegration';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validHttpIntegration(
  input: unknown,
): Result<HttpIntegration, ValidationError> {
  return validate(httpIntegrationSchema, input);
}
