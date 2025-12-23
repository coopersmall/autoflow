/**
 * Upload state cache interface.
 *
 * This cache tracks transient file upload states ('uploading', 'failed').
 * It is NOT used for successfully uploaded files - storage is the
 * source of truth for 'ready' state.
 *
 * ## Cache Lifecycle
 *
 * 1. **Upload starts** - Entry created with state 'uploading'
 * 2. **Upload succeeds** - Entry deleted (storage becomes source of truth)
 * 3. **Upload fails** - Entry updated to state 'failed' with error message
 * 4. **TTL expires** - Entry automatically removed
 *
 * ## Why Use Cache?
 *
 * The cache allows clients to check upload progress without polling storage.
 * Since storage operations are expensive, the cache provides a fast way to
 * determine if an upload is in progress or has failed.
 *
 * @see UploadState - The state object stored in this cache
 * @see UploadStateId - The key type for this cache
 */

import type { ISharedCache } from "@backend/infrastructure/cache/SharedCache";
import type { UploadState, UploadStateId } from "./UploadState";

/**
 * Cache interface for upload state tracking.
 *
 * Extends ISharedCache with UploadStateId keys and UploadState values.
 * The cache is backed by Redis and provides TTL-based expiration.
 */
export type IUploadStateCache = ISharedCache<UploadStateId, UploadState>;
