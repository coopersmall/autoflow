import type { ValidationError } from '@core/errors/ValidationError';
import type { Validator } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export interface ExtractRequestBodyRequest<T> {
  request: Request;
  validator: Validator<T>;
}

/**
 * Extracts and validates the request body from the HTTP request.
 * Parses JSON body and uses the provided validator to ensure type safety and data correctness.
 *
 * @param params - Extraction parameters
 * @param params.request - HTTP request containing JSON body
 * @param params.validator - Validator function for type safety and validation
 * @returns Promise resolving to Result containing validated value or validation error
 */
export async function extractRequestBody<T>({
  request,
  validator,
}: ExtractRequestBodyRequest<T>): Promise<Result<T, ValidationError>> {
  const body = await request.json();
  return validator(body);
}
