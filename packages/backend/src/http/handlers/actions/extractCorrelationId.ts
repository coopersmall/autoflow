import { CorrelationId } from '@core/domain/CorrelationId';
import { getHeader } from './getHeader';

export const CORRELATION_ID_HEADER = 'X-Correlation-Id' as const;

export interface ExtractCorrelationIdRequest {
  headers: Headers;
}

/**
 * Extracts correlation ID from request headers for distributed tracing.
 *
 * Checks for 'x-correlation-id' header (case-insensitive).
 * If header is missing or empty, generates a new UUID v4 correlation ID.
 *
 * @param params - Parameters object
 * @param params.headers - HTTP headers from the request
 * @param actions - Injectable actions for testing
 * @returns Correlation ID string (existing or newly generated)
 */
export function extractCorrelationId(
  { headers }: ExtractCorrelationIdRequest,
  actions = { getHeader },
): CorrelationId {
  const headerValue = actions.getHeader(headers, CORRELATION_ID_HEADER);
  if (!headerValue) {
    return CorrelationId();
  }
  return CorrelationId(headerValue);
}
