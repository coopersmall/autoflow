import type { Request } from '@backend/infrastructure/http/handlers/domain/Request';
import type { AppError } from '@core/errors';
import type { Validator } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export interface ExtractRequestParamRequest<T> {
  request: Request;
  name: string;
  validator: Validator<T>;
}

/**
 * Extracts and validates a path parameter from the HTTP request.
 * Uses the provided validator to ensure type safety and data correctness.
 *
 * @param params - Extraction parameters
 * @param params.request - HTTP request containing path parameters
 * @param params.name - Name of the path parameter (e.g., 'id' from '/users/:id')
 * @param params.validator - Validator function for type safety and validation
 * @returns Result containing validated value or validation error
 */
export function extractRequestParam<T>({
  request,
  name,
  validator,
}: ExtractRequestParamRequest<T>): Result<T, AppError> {
  const value = request.params[name];
  return validator(value);
}
