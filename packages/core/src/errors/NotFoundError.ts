import { type ErrorMetadata, ErrorWithMetadata } from './ErrorWithMetadata.ts';

export class NotFoundError extends ErrorWithMetadata {
  constructor(resource: string, metadata?: ErrorMetadata) {
    super(`Resource not found`, 'NotFound', {
      resource,
      ...metadata,
    });
    this.name = 'NotFoundError';
  }
}
