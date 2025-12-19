import type { AppError, ErrorCode } from '@core/errors/AppError';

const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Timeout: 408,
  TooManyRequests: 429,
  InternalServer: 500,
  GatewayTimeout: 504,
};

/**
 * Maps AppError to HTTP Response with appropriate status code.
 *
 * Status Code Mapping:
 * - BadRequest → 400
 * - Unauthorized → 401
 * - Forbidden → 403
 * - NotFound → 404
 * - Timeout → 408
 * - TooManyRequests → 429
 * - InternalServer → 500
 * - GatewayTimeout → 504
 *
 * Response Body Format:
 * ```json
 * {
 *   "message": "Error message",
 *   "code": "ErrorCode"
 * }
 * ```
 *
 * Architecture Note:
 * This provides centralized error-to-HTTP mapping. All errors flow through here,
 * ensuring consistent error responses across the application.
 *
 * @param error - AppError containing message and code
 * @returns HTTP Response with appropriate status code and JSON body
 */
export function createResponseFromError(error: AppError): Response {
  const status = HTTP_STATUS_MAP[error.code] ?? 500;

  return new Response(
    JSON.stringify({
      message: error.message,
      code: error.code,
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
