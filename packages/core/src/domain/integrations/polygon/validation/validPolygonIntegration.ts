import {
  type PolygonIntegration,
  polygonIntegrationSchema,
} from '@core/domain/integrations/polygon/PolygonIntegration';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validPolygonIntegration(
  input: unknown,
): Result<PolygonIntegration, AppError> {
  return validate(polygonIntegrationSchema, input);
}
