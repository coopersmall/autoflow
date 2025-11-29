import {
  type PolygonIntegration,
  polygonIntegrationSchema,
} from '@core/domain/integrations/polygon/PolygonIntegration';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validPolygonIntegration(
  input: unknown,
): Result<PolygonIntegration, ValidationError> {
  return validate(polygonIntegrationSchema, input);
}
