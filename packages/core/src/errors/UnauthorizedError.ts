import { ErrorWithMetadata } from './ErrorWithMetadata.ts';

export class UnauthorizedError extends ErrorWithMetadata {
  constructor(metadata?: Record<string, unknown>) {
    super('Unauthorized access', 'Unauthorized', {
      ...metadata,
    });
    this.name = 'UnauthorizedError';
  }
}

export function isUnauthorizedError(
  error: unknown,
): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}
