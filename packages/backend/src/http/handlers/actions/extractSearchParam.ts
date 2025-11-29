import type { ValidationError } from '@core/errors/ValidationError';
import type { Validator } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export interface ExtractSearchParamRequest<T> {
  searchParams: URLSearchParams;
  name: string;
  validator: Validator<T>;
}

/**
 * Extracts and validates a query string parameter from the HTTP request.
 * Uses the provided validator to ensure type safety and data correctness.
 *
 * @param params - Extraction parameters
 * @param params.searchParams - URL search parameters from request (e.g., ?page=1&limit=10)
 * @param params.name - Name of the query parameter (e.g., 'page')
 * @param params.validator - Validator function for type safety and validation
 * @returns Result containing validated value or validation error
 */
export function extractSearchParam<T>({
  searchParams,
  name,
  validator,
}: ExtractSearchParamRequest<T>): Result<T, ValidationError> {
  const value = searchParams.get(name);
  return validator(value);
}
