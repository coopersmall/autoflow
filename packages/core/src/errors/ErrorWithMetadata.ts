import type { ErrorCode } from './errorCode.ts';

export interface ErrorMetadata {
  [key: string]: unknown;
  cause?: unknown;
}

export class ErrorWithMetadata extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode = 'InternalServer',
    readonly metadata: ErrorMetadata = {},
  ) {
    super(message);
    this.name = 'ErrorWithMetadata';
    if (metadata.cause instanceof Error) {
      this.stack = metadata.cause.stack;
    }
  }

  toJSON(): {
    name: string;
    message: string;
    code: ErrorCode;
    metadata: ErrorMetadata;
    stack?: string;
  } {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      stack: this.stack,
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }
}
