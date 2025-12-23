import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, type Result } from 'neverthrow';
import type { RetryConfig } from '../../../../domain/MiddlewareConfig';
import { isRetryableError } from './isRetryableError';

/**
 * Wraps an operation with retry logic using exponential backoff.
 *
 * @param operation - Function that returns a Result
 * @param config - Retry configuration
 * @returns Result from the operation (after retries if needed)
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => uploadFile(buffer),
 *   { maxAttempts: 3, initialDelayMs: 100, ... }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<Result<T, AppError>>,
  config: RetryConfig,
): Promise<Result<T, AppError>> {
  let lastError: AppError | undefined;
  let currentDelay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    const result = await operation();

    // Success - return immediately
    if (result.isOk()) {
      return result;
    }

    lastError = result.error;

    // Last attempt or non-retryable error - fail immediately
    if (attempt === config.maxAttempts || !isRetryableError(lastError)) {
      return result;
    }

    // Calculate delay with jitter if enabled
    const delay = config.jitter
      ? currentDelay * (0.5 + Math.random() * 0.5)
      : currentDelay;

    // Wait before next retry
    await sleep(Math.min(delay, config.maxDelayMs));

    // Exponential backoff for next iteration
    currentDelay *= config.backoffMultiplier;
  }

  // This should never be reached due to the loop logic above,
  // but TypeScript needs a return statement. Return the last error.
  return err(
    lastError ??
      internalError('Retry logic failed without capturing error', {
        metadata: { maxAttempts: config.maxAttempts },
      }),
  );
}

/**
 * Sleep for the specified duration in milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
