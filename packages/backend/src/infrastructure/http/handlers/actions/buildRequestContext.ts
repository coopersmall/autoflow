import type { Request } from '@backend/infrastructure/http/handlers/domain/Request';
import type { RequestContext } from '@backend/infrastructure/http/handlers/domain/RequestContext';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { Validator } from '@core/validation/validate';
import { extractRequestBody } from './extractRequestBody.ts';
import { extractRequestHeader } from './extractRequestHeader.ts';
import { extractRequestParam } from './extractRequestParam.ts';
import { extractSearchParam } from './extractSearchParam.ts';

export interface BuildRequestContextRequest {
  correlationId: CorrelationId;
  request: Request;
}

/**
 * Builds a RequestContext object with type-safe data extraction helpers.
 *
 * The RequestContext provides:
 * - correlationId: For distributed tracing
 * - session: User session (undefined if not authenticated via middleware)
 * - getParam: Extract and validate path parameters (e.g., /users/:id)
 * - getSearchParam: Extract and validate query string parameters (e.g., ?page=1)
 * - getBody: Extract and validate request body with type safety
 * - getHeader: Extract header values by name
 *
 * Architecture Note:
 * Session comes from request.context.userSession, which is set by authentication
 * middleware BEFORE this function is called. Public handlers will have undefined session.
 *
 * @param params - Request context build parameters
 * @param params.correlationId - Correlation ID for this request
 * @param params.request - HTTP request (may include userSession from middleware)
 * @param actions - Injectable actions for testing (extractors for params, body, headers)
 * @returns Complete RequestContext with all helper methods bound
 */
export function buildRequestContext(
  { correlationId, request }: BuildRequestContextRequest,
  actions = {
    extractRequestParam,
    extractSearchParam,
    extractRequestBody,
    extractRequestHeader,
  },
): RequestContext {
  const url = new URL(request.url);

  return {
    correlationId,
    session: request.context?.userSession,
    getParam: <T>(name: string, validator: Validator<T>) =>
      actions.extractRequestParam<T>({ request, name, validator }),
    getSearchParam: <T>(name: string, validator: Validator<T>) =>
      actions.extractSearchParam<T>({
        searchParams: url.searchParams,
        name,
        validator,
      }),
    getBody: <T>(validator: Validator<T>) =>
      actions.extractRequestBody<T>({ request, validator }),
    getHeader: (name: string) =>
      actions.extractRequestHeader({ headers: request.headers, name }),
  };
}
