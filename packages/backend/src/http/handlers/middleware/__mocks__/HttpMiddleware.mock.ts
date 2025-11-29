import type { IHttpMiddleware } from '@backend/http/handlers/domain/HttpMiddleware';
import type { Request } from '@backend/http/handlers/domain/Request';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export function getMockMiddleware(
  behavior?: 'success' | 'error',
  errorToReturn?: ErrorWithMetadata,
): IHttpMiddleware {
  return {
    handle: async (
      request: Request,
    ): Promise<Result<Request, ErrorWithMetadata>> => {
      if (behavior === 'error' && errorToReturn) {
        return err(errorToReturn);
      }
      return ok(request);
    },
  };
}
