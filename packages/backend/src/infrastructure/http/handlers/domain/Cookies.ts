/**
 * Cookie handling types for HTTP request processing.
 *
 * Type alias for Bun's native CookieMap, providing consistent typing
 * across the handler layer for cookie operations.
 */
import type { CookieMap } from 'bun';

/**
 * Cookie map type for accessing request cookies.
 *
 * Provides a Map-like interface for reading cookie values by name.
 * Cookies are extracted from requests by middleware and used for
 * session authentication.
 *
 * @example
 * ```ts
 * const cookies: Cookies = request.cookies;
 * const sessionToken = cookies.get('session_token');
 * ```
 */
export type Cookies = CookieMap;
