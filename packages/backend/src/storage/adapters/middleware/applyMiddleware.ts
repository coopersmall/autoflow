/**
 * Middleware composition for storage providers.
 *
 * This module applies configured middleware layers to a base storage provider.
 * Currently supports retry middleware with exponential backoff.
 *
 * @module storage/adapters/middleware/applyMiddleware
 */

import {
  DEFAULT_RETRY_CONFIG,
  type MiddlewareConfig,
} from "@backend/storage/domain/MiddlewareConfig";
import type { IStorageProvider } from "../../domain/StorageProvider";
import { createRetryMiddleware } from "./retry/RetryMiddleware";

/**
 * Applies configured middleware to a storage provider.
 *
 * Middleware is applied in order, with each layer wrapping the previous.
 * Currently only retry middleware is supported.
 *
 * ## Configuration
 *
 * - `retry: undefined` - Uses DEFAULT_RETRY_CONFIG
 * - `retry: false` - Disables retry middleware
 * - `retry: RetryConfig` - Uses custom retry configuration
 *
 * @param provider - The base storage provider to wrap
 * @param config - Middleware configuration options
 * @returns Provider wrapped with middleware, or original if all disabled
 *
 * @example
 * ```typescript
 * // With default retry
 * const provider = applyMiddleware(baseProvider, {});
 *
 * // With custom retry
 * const provider = applyMiddleware(baseProvider, {
 *   retry: { maxAttempts: 5, initialDelayMs: 200, ... },
 * });
 *
 * // Without retry
 * const provider = applyMiddleware(baseProvider, { retry: false });
 * ```
 */
export function applyMiddleware(
  provider: IStorageProvider,
  config: MiddlewareConfig,
): IStorageProvider {
  const finalProvider = provider;
  if (config.retry !== false) {
    return createRetryMiddleware(
      provider,
      config.retry ?? DEFAULT_RETRY_CONFIG,
    );
  }
  return finalProvider;
}
