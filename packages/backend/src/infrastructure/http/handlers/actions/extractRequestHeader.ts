export interface ExtractRequestHeaderRequest {
  headers: Headers;
  name: string;
}

/**
 * Extracts a header value from the HTTP request by name.
 * Returns undefined if the header is not present.
 *
 * @param params - Extraction parameters
 * @param params.headers - HTTP headers from the request
 * @param params.name - Name of the header to extract (e.g., 'content-type')
 * @returns Header value as string, or undefined if not present
 */
export function extractRequestHeader({
  headers,
  name,
}: ExtractRequestHeaderRequest): string | undefined {
  const value = headers.get(name);
  return value ?? undefined;
}
