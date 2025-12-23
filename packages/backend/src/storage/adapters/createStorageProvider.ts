/**
 * Factory for creating storage providers based on configuration.
 *
 * This factory abstracts the creation of storage providers, allowing
 * the service to work with different storage backends (GCS, S3, etc.)
 * without coupling to specific implementations.
 */

import type { GCPAuthMechanism, ILogger } from '@backend/infrastructure';
import { unreachable } from '@core/unreachable';
import type { MiddlewareConfig } from '../domain/MiddlewareConfig';
import type { IStorageProvider } from '../domain/StorageProvider';
import { createGCSStorageAdapter } from './GCSStorageAdapter';
import { applyMiddleware } from './middleware/applyMiddleware';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GCS storage provider configuration.
 */
export interface GCSProviderConfig {
  readonly type: 'gcs';
  readonly auth: GCPAuthMechanism;
  readonly bucketName: string;
  readonly middleware?: MiddlewareConfig;
}

/**
 * Union of all supported storage provider configurations.
 * Add new provider types here as they are implemented.
 */
export type StorageProviderConfig = GCSProviderConfig;

// ─────────────────────────────────────────────────────────────────────────────
// Factory Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a storage provider based on configuration.
 *
 * @param config - Storage provider configuration
 * @returns IStorageProvider implementation
 *
 * @example
 * ```typescript
 * // Create a GCS provider
 * const provider = createStorageProvider({
 *   type: 'gcs',
 *   client: gcsClient,
 *   bucketName: 'my-bucket',
 * });
 *
 * // Use the provider
 * await provider.put('file.txt', buffer, { contentType: 'text/plain' });
 * ```
 */
export function createStorageProvider(
  logger: ILogger,
  config: StorageProviderConfig,
): IStorageProvider {
  let baseProvider: IStorageProvider;
  switch (config.type) {
    case 'gcs': {
      baseProvider = createGCSStorageAdapter(
        config.auth,
        logger,
        config.bucketName,
      );
      break;
    }
    default:
      unreachable(config.type);
  }
  if (config.middleware) {
    return applyMiddleware(baseProvider, config.middleware);
  } else {
    return baseProvider;
  }
}
