/**
 * HTTP error response builder for handler error handling.
 *
 * Converts AppError instances into appropriate HTTP JSON responses
 * with correct status codes. Used by SharedHttpHandler and StandardHttpHandler
 * to provide consistent error responses across CRUD operations.
 *
 * Status Code Mapping:
 * - NotFound → 404: Resource not found
 * - Unauthorized → 401: Authentication required or credentials invalid
 * - Forbidden → 403: Authenticated but insufficient permissions
 * - BadRequest → 400: Invalid operation or state (e.g., invalid task state transition)
 * - AppError → 400: Invalid request data (includes validation details)
 * - All others → 500: Internal server error (includes error details)
 *
 * Response Format:
 * ```json
 * {
 *   "error": "User-friendly error message",
 *   "details": { ... } // Optional: error details for debugging
 * }
 * ```
 *
 * Architecture Note:
 * This provides centralized error-to-HTTP mapping for handler layer.
 * Similar to createResponseFromError but used specifically in CRUD handlers.
 */

import type { AppError } from '@core/errors/AppError';

/**
 * Builds an HTTP Response from an error with appropriate status code and body.
 *
 * @param error - Error to convert to HTTP response
 * @returns HTTP Response with JSON body and appropriate status code
 *
 * @example
 * ```ts
 * const result = await service.get(id);
 * if (result.isErr()) {
 *   return buildHttpErrorResponse(result.error);
 * }
 * ```
 */
export function buildHttpErrorResponse(error: AppError) {
  switch (error.code) {
    case 'NotFound':
      return Response.json({ error: 'Item not found' }, { status: 404 });
    case 'Unauthorized':
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    case 'Forbidden':
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    case 'BadRequest':
      // Check if this is a validation error with Zod issues
      if (error.metadata && 'issues' in error.metadata) {
        return Response.json(
          { error: 'Validation error', details: error.metadata },
          { status: 400 },
        );
      }
      return Response.json(
        { error: error.message || 'Bad request' },
        { status: 400 },
      );
    default:
      return Response.json(
        { error: 'Internal server error', details: error },
        { status: 500 },
      );
  }
}
