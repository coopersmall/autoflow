import { isSystemError, type SystemError } from './Error';
import { ErrorWithMetadata } from './ErrorWithMetadata';

export function getErrorFromString(errorString: string): SystemError {
  const parsed = JSON.parse(errorString);
  if (isSystemError(parsed)) {
    return parsed;
  }
  return new ErrorWithMetadata(errorString, 'InternalServer', {
    originalError: parsed,
  });
}
