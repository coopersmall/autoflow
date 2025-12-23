/**
 * Configuration options for middleware handling storage operations.
 */
export interface MiddlewareConfig {
  /**
   * Retry configuration for transient failures.
   * - If undefined: uses DEFAULT_RETRY_CONFIG
   * - If false: disables retry
   * - If RetryConfig: uses custom config
   */
  retry?: RetryConfig | false;
}

/**
 * Configuration for retry behavior in storage operations.
 */
export interface RetryConfig {
  /**
   * Maximum number of attempts (including initial attempt).
   * Must be >= 1.
   */
  maxAttempts: number;

  /**
   * Initial delay between retries in milliseconds.
   * Must be > 0.
   */
  initialDelayMs: number;

  /**
   * Maximum delay between retries in milliseconds.
   * Must be >= initialDelayMs.
   */
  maxDelayMs: number;

  /**
   * Multiplier for exponential backoff.
   * Must be >= 1.
   */
  backoffMultiplier: number;

  /**
   * Whether to add random jitter to delays.
   * Helps prevent thundering herd.
   */
  jitter: boolean;
}

/**
 * Default retry configuration for storage operations.
 * - 3 attempts total (initial + 2 retries)
 * - Exponential backoff: 100ms, 200ms
 * - Max delay capped at 5s
 * - Equal jitter enabled
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitter: true,
};
