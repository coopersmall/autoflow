import {
  type PolygonIntegration,
  polygonIntegrationSchema,
} from '@core/domain/integrations/polygon/PolygonIntegration.ts';
import type { AppError } from '@core/errors/AppError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';

export function validPolygonIntegration(
  input: unknown,
): Result<PolygonIntegration, AppError> {
  return validate(polygonIntegrationSchema, input);
}
