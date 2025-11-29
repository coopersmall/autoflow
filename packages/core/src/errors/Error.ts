import type { ErrorWithMetadata } from './ErrorWithMetadata';
import type { NotFoundError } from './NotFoundError';
import type { TimeoutError } from './TimeoutError';
import type { UnauthorizedError } from './UnauthorizedError';
import type { ValidationError } from './ValidationError';

export type SystemError =
  | ErrorWithMetadata
  | ValidationError
  | NotFoundError
  | TimeoutError
  | UnauthorizedError;

export function isValidationErrorData(data: unknown): data is ValidationError {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    data.name === 'ValidationError'
  );
}

export function isNotFoundErrorData(data: unknown): data is NotFoundError {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    data.name === 'NotFoundError'
  );
}

export function isTimeoutErrorData(data: unknown): data is TimeoutError {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    data.name === 'TimeoutError'
  );
}

export function isUnauthorizedErrorData(
  data: unknown,
): data is UnauthorizedError {
  return (
    typeof data === 'object' &&
    data !== null &&
    'name' in data &&
    data.name === 'UnauthorizedError'
  );
}

export function isErrorWithMetadataData(
  data: unknown,
): data is ErrorWithMetadata {
  return typeof data === 'object' && data !== null && 'metadata' in data;
}

export function isSystemError(data: unknown): data is SystemError {
  return (
    isValidationErrorData(data) ||
    isNotFoundErrorData(data) ||
    isTimeoutErrorData(data) ||
    isUnauthorizedErrorData(data) ||
    isErrorWithMetadataData(data)
  );
}
