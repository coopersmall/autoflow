import type { ErrorWithMetadata } from './ErrorWithMetadata';
import type { TimeoutError } from './TimeoutError';
import type { UnauthorizedError } from './UnauthorizedError';

export type HttpRequestError =
  | TimeoutError
  | UnauthorizedError
  | ErrorWithMetadata;
