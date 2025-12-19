import { type AppError, internalError, isAppError } from './index';

export function getErrorFromString(errorString: string): AppError {
  try {
    const parsed = JSON.parse(errorString);
    if (isAppError(parsed)) {
      return parsed;
    }
    return internalError(errorString, {
      metadata: { originalError: parsed },
    });
  } catch {
    return internalError(errorString);
  }
}
