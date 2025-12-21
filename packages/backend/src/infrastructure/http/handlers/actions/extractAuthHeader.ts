import { getHeader } from './getHeader';

const AUTHORIZATION_HEADER = 'Authorization' as const;

export interface ExtractAuthHeaderRequest {
  headers: Headers;
}

/**
 * Extracts authorization header from request headers.
 *
 * Checks for 'Authorization' header (case-insensitive).
 *
 * @param params - Parameters object
 * @param params.headers - HTTP headers from the request
 * @param actions - Injectable actions for testing
 * @returns Authorization header value or undefined if not present
 */
export function extractAuthHeader(
  { headers }: ExtractAuthHeaderRequest,
  actions = { getHeader },
): string | undefined {
  return actions.getHeader(headers, AUTHORIZATION_HEADER);
}
