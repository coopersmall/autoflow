import {
  type HttpIntegration,
  httpIntegrationSchema,
} from '@core/domain/integrations/http/HttpIntegration';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validHttpIntegration(
  input: unknown,
): Result<HttpIntegration, AppError> {
  return validate(httpIntegrationSchema, input);
}
