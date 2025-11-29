/**
 * Extracts a header value from HTTP headers by name.
 *
 * Case-insensitive header lookup. Returns undefined if header is not present.
 * Utility function used by other extractors (auth header, correlation ID, etc.).
 *
 * @param headers - HTTP headers object
 * @param header - Name of header to extract (case-insensitive)
 * @returns Header value or undefined if not present
 */
export function getHeader(
  headers: Headers,
  header: string,
): string | undefined {
  const value = headers.get(header);
  return value !== null ? value : undefined;
}
