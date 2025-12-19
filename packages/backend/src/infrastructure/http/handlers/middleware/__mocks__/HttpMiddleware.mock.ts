import type { IHttpMiddleware } from '@backend/infrastructure/http/handlers/domain/HttpMiddleware';
import type { Request } from '@backend/infrastructure/http/handlers/domain/Request';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export function getMockMiddleware(
  behavior?: 'success' | 'error',
  errorToReturn?: AppError,
): IHttpMiddleware {
  return {
    handle: async (request: Request): Promise<Result<Request, AppError>> => {
      if (behavior === 'error' && errorToReturn) {
        return err(errorToReturn);
      }
      return ok(request);
    },
  };
}
