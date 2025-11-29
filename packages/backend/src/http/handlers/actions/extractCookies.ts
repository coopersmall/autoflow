import type { Cookies } from '@backend/http/handlers/domain/Cookies';
import type { Request } from '@backend/http/handlers/domain/Request';
import type { ILogger } from '@backend/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';

export interface ExtractCookiesContext {
  logger: ILogger;
}

export interface ExtractCookiesRequest {
  correlationId: CorrelationId;
  request: Request;
}

/**
 * Safely extracts cookies from an HTTP request with comprehensive error handling.
 *
 * This function wraps cookie extraction in try-catch to handle malformed cookies
 * or other parsing errors gracefully. Logs errors but returns undefined rather
 * than throwing to prevent request failures due to cookie issues.
 *
 * @param ctx - Context with logger for error reporting
 * @param params - Parameters object
 * @param params.request - HTTP request object
 * @param params.correlationId - Optional correlation ID for error logging
 * @returns Cookie map if successful, undefined if extraction fails
 */
export function extractCookies(
  ctx: ExtractCookiesContext,
  { correlationId, request }: ExtractCookiesRequest,
): Cookies | undefined {
  try {
    if (request.cookies) {
      ctx.logger.debug('Extracted cookies from request', {
        correlationId,
        cookieCount: request.cookies.size,
      });
      return request.cookies;
    }

    ctx.logger.debug('No cookies found in request', { correlationId });

    return;
  } catch (error) {
    ctx.logger.error('Error extracting cookies from request', error, {
      correlationId,
      cause: error,
    });
    return;
  }
}
