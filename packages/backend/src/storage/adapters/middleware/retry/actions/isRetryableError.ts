import { isAppError } from '@core/errors/AppError';

/**
 * Determines if an error is retryable based on its ErrorCode.
 *
 * Retryable errors:
 * - Timeout (408)
 * - TooManyRequests (429)
 * - InternalServer (500/502/503)
 * - GatewayTimeout (504)
 *
 * Non-retryable errors:
 * - BadRequest (400)
 * - Unauthorized (401)
 * - Forbidden (403)
 * - NotFound (404)
 */
export function isRetryableError(error: unknown): boolean {
  if (!isAppError(error)) {
    return false;
  }

  const retryableCodes = new Set([
    'Timeout',
    'TooManyRequests',
    'InternalServer',
    'GatewayTimeout',
  ]);

  return retryableCodes.has(error.code);
}
