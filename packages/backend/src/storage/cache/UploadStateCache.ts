/**
 * Cache for tracking upload state during file uploads.
 *
 * This cache tracks transient states ('uploading', 'failed') for files.
 * Successfully uploaded files do NOT have cache entries - storage is the
 * source of truth for 'ready' state.
 *
 * @module storage/cache/UploadStateCache
 */

import { SharedCache } from '@backend/infrastructure/cache/SharedCache';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import {
  type UploadState,
  type UploadStateId,
  validUploadState,
} from './domain/UploadState';
import type { IUploadStateCache } from './domain/UploadStateCache';

/**
 * Creates an upload state cache instance.
 *
 * The cache is backed by Redis and uses the 'upload-state' namespace.
 * All entries are validated against the UploadState schema on read.
 *
 * @param config - Configuration containing logger and app config (for Redis connection)
 * @returns Frozen IUploadStateCache instance
 *
 * @example
 * ```typescript
 * const cache = createUploadStateCache({
 *   logger,
 *   appConfig,
 * });
 *
 * // Store upload state
 * await cache.set(ctx, uploadStateId, uploadState, ttlSeconds);
 *
 * // Retrieve upload state
 * const result = await cache.get(ctx, uploadStateId);
 * ```
 */
export function createUploadStateCache(config: {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}): IUploadStateCache {
  return Object.freeze(new UploadStateCache(config.logger, config.appConfig));
}

class UploadStateCache
  extends SharedCache<UploadStateId, UploadState>
  implements IUploadStateCache
{
  constructor(logger: ILogger, appConfig: IAppConfigurationService) {
    super('upload-state', {
      appConfig,
      logger,
      validator: validUploadState,
    });
  }
}
