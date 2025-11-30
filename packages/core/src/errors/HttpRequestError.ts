import type { ErrorWithMetadata } from './ErrorWithMetadata.ts';
import type { TimeoutError } from './TimeoutError.ts';
import type { UnauthorizedError } from './UnauthorizedError.ts';

export type HttpRequestError =
  | TimeoutError
  | UnauthorizedError
  | ErrorWithMetadata;
