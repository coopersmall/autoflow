import {
  type PolygonIntegration,
  polygonIntegrationSchema,
} from '@core/domain/integrations/polygon/PolygonIntegration.ts';
import type { ValidationError } from '@core/errors/ValidationError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';

export function validPolygonIntegration(
  input: unknown,
): Result<PolygonIntegration, ValidationError> {
  return validate(polygonIntegrationSchema, input);
}
