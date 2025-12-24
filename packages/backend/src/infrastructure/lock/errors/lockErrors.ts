import { type AppError, badRequest, internalError } from '@core/errors';

/**
 * Creates an error when a lock cannot be acquired because it's already held.
 */
export function lockNotAcquiredError(namespace: string, id: string): AppError {
  return badRequest(`Lock not acquired: ${namespace}:${id} is already held`, {
    metadata: { namespace, id },
  });
}

/**
 * Creates an error when a lock operation fails.
 */
export function lockOperationError(
  operation: string,
  key: string,
  cause: unknown,
): AppError {
  return internalError(`Lock operation "${operation}" failed for key: ${key}`, {
    cause,
    metadata: { operation, key },
  });
}
