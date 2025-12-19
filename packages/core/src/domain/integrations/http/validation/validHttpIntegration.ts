import {
  type HttpIntegration,
  httpIntegrationSchema,
} from '@core/domain/integrations/http/HttpIntegration.ts';
import type { AppError } from '@core/errors/AppError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';

export function validHttpIntegration(
  input: unknown,
): Result<HttpIntegration, AppError> {
  return validate(httpIntegrationSchema, input);
}
