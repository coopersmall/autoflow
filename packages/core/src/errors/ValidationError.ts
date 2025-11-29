import type { ZodError } from 'zod';
import { type ErrorMetadata, ErrorWithMetadata } from './ErrorWithMetadata';

export class ValidationError extends ErrorWithMetadata {
  constructor(error: ZodError, metadata: ErrorMetadata = {}) {
    super(`Validation failed`, 'BadRequest', {
      issues: error.issues,
      cause: error,
      ...metadata,
    });
    this.name = 'ValidationError';
  }
}
