import {
  DEFAULT_RETRY_CONFIG,
  type MiddlewareConfig,
} from '@backend/storage/domain/MiddlewareConfig';
import type { IStorageProvider } from '../../domain/StorageProvider';
import { createRetryMiddleware } from './retry/RetryMiddleware';

/**
 * Applies retry middleware to a storage provider.
 *
 * @param provider - The base storage provider to wrap
 * @param config - Middleware configuration options
 * @returns Provider wrapped with middleware, or original if disabled
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
