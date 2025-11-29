/**
 * HTTP client for integration testing.
 *
 * Provides convenience methods for making HTTP requests to test servers.
 * Separated from TestHttpServer for clean architecture - this class is only
 * responsible for making requests, not managing server lifecycle.
 *
 * Features:
 * - Convenience methods for all HTTP verbs (GET, POST, PUT, DELETE, PATCH)
 * - Automatic JSON serialization for request bodies
 * - Type-safe response parsing helpers
 * - Automatic Content-Type headers for JSON requests
 *
 * NOT responsible for:
 * - Server management (use TestHttpServer)
 * - Authentication token generation (use TestAuth)
 * - Port allocation (use TestPortPool)
 */

import type { Validator } from '@core/validation/validate';
import type { Result } from 'neverthrow';

/**
 * HTTP client for making requests in integration tests.
 *
 * @example
 * ```typescript
 * const client = new TestHttpClient('http://localhost:9000');
 * const response = await client.get('/api/users');
 * const users = await client.parseJson<User[]>(response);
 * ```
 */
export class TestHttpClient {
  /**
   * Creates a new test HTTP client.
   *
   * @param baseUrl - Base URL of the test server (e.g., 'http://localhost:9000')
   */
  constructor(private readonly baseUrl: string) {}

  /**
   * Performs a GET request.
   *
   * @param path - Request path (e.g., '/api/users')
   * @param options - Optional fetch options (headers, signal, etc.)
   * @returns Response from the server
   *
   * @example
   * ```typescript
   * const response = await client.get('/api/users', {
   *   headers: { 'Authorization': 'Bearer token' }
   * });
   * ```
   */
  async get(path: string, options?: RequestInit): Promise<Response> {
    return this.fetch(path, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Performs a POST request with JSON body.
   *
   * @param path - Request path (e.g., '/api/users')
   * @param body - Request body (will be JSON serialized)
   * @param options - Optional fetch options (headers, signal, etc.)
   * @returns Response from the server
   *
   * @example
   * ```typescript
   * const response = await client.post('/api/users', {
   *   name: 'John Doe',
   *   email: 'john@example.com'
   * }, {
   *   headers: { 'Authorization': 'Bearer token' }
   * });
   * ```
   */
  async post(
    path: string,
    body: unknown,
    options?: RequestInit,
  ): Promise<Response> {
    return this.fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
      ...options,
    });
  }

  /**
   * Performs a PUT request with JSON body.
   *
   * @param path - Request path (e.g., '/api/users/123')
   * @param body - Request body (will be JSON serialized)
   * @param options - Optional fetch options (headers, signal, etc.)
   * @returns Response from the server
   *
   * @example
   * ```typescript
   * const response = await client.put('/api/users/123', {
   *   name: 'Jane Doe'
   * }, {
   *   headers: { 'Authorization': 'Bearer token' }
   * });
   * ```
   */
  async put(
    path: string,
    body: unknown,
    options?: RequestInit,
  ): Promise<Response> {
    return this.fetch(path, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
      ...options,
    });
  }

  /**
   * Performs a DELETE request.
   *
   * @param path - Request path (e.g., '/api/users/123')
   * @param options - Optional fetch options (headers, signal, etc.)
   * @returns Response from the server
   *
   * @example
   * ```typescript
   * const response = await client.delete('/api/users/123', {
   *   headers: { 'Authorization': 'Bearer token' }
   * });
   * ```
   */
  async delete(path: string, options?: RequestInit): Promise<Response> {
    return this.fetch(path, {
      method: 'DELETE',
      ...options,
    });
  }

  /**
   * Performs a PATCH request with JSON body.
   *
   * @param path - Request path (e.g., '/api/users/123')
   * @param body - Request body (will be JSON serialized)
   * @param options - Optional fetch options (headers, signal, etc.)
   * @returns Response from the server
   *
   * @example
   * ```typescript
   * const response = await client.patch('/api/users/123', {
   *   email: 'newemail@example.com'
   * }, {
   *   headers: { 'Authorization': 'Bearer token' }
   * });
   * ```
   */
  async patch(
    path: string,
    body: unknown,
    options?: RequestInit,
  ): Promise<Response> {
    return this.fetch(path, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
      ...options,
    });
  }

  /**
   * Parses response body as JSON with type safety.
   *
   * @param response - Response from server
   * @returns Parsed JSON data
   *
   * @example
   * ```typescript
   * const response = await client.get('/api/users');
   * const users = await client.parseJson<User[]>(response);
   * ```
   */
  async parseJson<T = unknown>(
    response: Response,
    validator: Validator<T>,
  ): Promise<Result<T, Error>> {
    const data = await response.json();
    return validator(data);
  }

  /**
   * Parses response body as text.
   *
   * @param response - Response from server
   * @returns Response body as string
   *
   * @example
   * ```typescript
   * const response = await client.get('/api/health');
   * const text = await client.parseText(response);
   * ```
   */
  async parseText(response: Response): Promise<string> {
    return response.text();
  }

  /**
   * Internal fetch wrapper that constructs full URL from base and path.
   *
   * @param path - Request path (e.g., '/api/users')
   * @param options - Fetch options
   * @returns Response from server
   */
  private async fetch(path: string, options: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    return fetch(url, options);
  }
}
