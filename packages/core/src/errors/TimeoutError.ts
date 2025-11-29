import { ErrorWithMetadata } from './ErrorWithMetadata';

export class TimeoutError extends ErrorWithMetadata {
  constructor(timeout: number, metadata?: Record<string, unknown>) {
    super('Timeout Occurred', 'Timeout', { ...metadata, timeout });
    this.name = 'TimeoutError';
  }
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}
