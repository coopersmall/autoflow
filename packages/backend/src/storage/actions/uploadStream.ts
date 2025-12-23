/**
 * Upload action for streaming file uploads.
 *
 * This action handles uploads of files from streams, supporting files of any size
 * with bounded memory usage. It manages upload state in cache and handles both
 * success and failure scenarios.
 *
 * @module storage/actions/uploadStream
 */

import type { Context } from "@backend/infrastructure/context";
import type { ILogger } from "@backend/infrastructure/logger/Logger";
import type { FileAsset } from "@core/domain/file";
import type { AppError } from "@core/errors/AppError";
import { err, ok, type Result } from "neverthrow";
import {
  UPLOAD_STATE_SCHEMA_VERSION,
  type UploadState,
  UploadStateId,
} from "../cache/domain/UploadState";
import type { IUploadStateCache } from "../cache/domain/UploadStateCache";
import type { IStorageProvider } from "../domain/StorageProvider";
import type { UploadStreamRequest } from "../domain/StorageTypes";
import { buildObjectKey, validateAndSanitizeFilename } from "./buildObjectKey";

/**
 * Dependencies required by the uploadStream action.
 */
export interface UploadStreamDeps {
  /** Storage provider for file operations */
  readonly storageProvider: IStorageProvider;
  /** Cache for tracking upload state */
  readonly uploadStateCache: IUploadStateCache;
  /** Logger for debugging and error reporting */
  readonly logger: ILogger;
  /** TTL in seconds for upload state in cache */
  readonly uploadStateTtlSeconds: number;
}

/**
 * Upload a file from a stream.
 *
 * This is the core upload method that handles files of any size. It uses
 * GCS resumable uploads internally, providing automatic retry for transient
 * failures during upload.
 *
 * ## State Management
 *
 * The upload goes through these states:
 * 1. **uploading** - Initial state, stored in cache
 * 2. **ready** - Upload succeeded, cache entry deleted (storage is source of truth)
 * 3. **failed** - Upload failed, cache entry updated with error
 *
 * ## Error Handling
 *
 * On upload failure, this function returns `Ok(FileAsset)` with `state: 'failed'`
 * rather than an error. This allows callers to inspect the failure and potentially
 * retry. The failed state is persisted in cache for the configured TTL.
 *
 * @param ctx - Request context for correlation and tracing
 * @param request - Upload request containing stream payload and folder
 * @param deps - Dependencies (storage provider, cache, logger, etc.)
 * @returns FileAsset with 'ready' or 'failed' state
 *
 * @example
 * ```typescript
 * const stream = file.stream(); // Get ReadableStream from File API
 * const result = await uploadStream(ctx, {
 *   payload: {
 *     id: FileAssetId(),
 *     filename: 'large-video.mp4',
 *     mediaType: 'video/mp4',
 *     stream,
 *     size: file.size, // Optional but helps optimize upload
 *   },
 *   folder: 'users/usr_123/videos',
 * }, deps);
 *
 * if (result.isOk() && result.value.state === 'ready') {
 *   console.log('Upload complete!');
 * } else if (result.isOk() && result.value.state === 'failed') {
 *   console.error('Upload failed:', result.value.error);
 * }
 * ```
 *
 * @see upload - For small buffered uploads with size limit
 */
export async function uploadStream(
  ctx: Context,
  request: UploadStreamRequest,
  deps: UploadStreamDeps,
): Promise<Result<FileAsset, AppError>> {
  const { storageProvider, uploadStateCache, logger, uploadStateTtlSeconds } =
    deps;
  const { payload, folder } = request;

  // Validate and sanitize filename
  const sanitizedResult = validateAndSanitizeFilename(payload.filename);
  if (sanitizedResult.isErr()) {
    return err(sanitizedResult.error);
  }
  const sanitizedFilename = sanitizedResult.value;

  const objectKey = buildObjectKey(folder, payload.id, payload.filename);
  const now = new Date();

  logger.debug("Starting stream upload", {
    fileId: payload.id,
    objectKey,
    size: payload.size ?? "unknown",
  });

  // Create upload state in cache
  const uploadStateId = UploadStateId(payload.id);
  const uploadState: UploadState = {
    id: uploadStateId,
    folder,
    filename: payload.filename,
    sanitizedFilename,
    mediaType: payload.mediaType,
    size: payload.size,
    state: "uploading",
    createdAt: now,
    updatedAt: now,
    schemaVersion: UPLOAD_STATE_SCHEMA_VERSION,
  };

  const cacheSetResult = await uploadStateCache.set(
    ctx,
    uploadStateId,
    uploadState,
    uploadStateTtlSeconds,
  );

  if (cacheSetResult.isErr()) {
    // Return a FileAsset with failed state if cache fails
    const fileAsset: FileAsset = {
      id: payload.id,
      state: "failed",
      filename: sanitizedFilename,
      originalFilename: payload.filename,
      mediaType: payload.mediaType,
      size: payload.size,
      error: cacheSetResult.error.message,
      createdAt: now,
    };
    return ok(fileAsset);
  }

  // Upload to storage
  const uploadResult = await storageProvider.putStream(
    objectKey,
    payload.stream,
    {
      contentType: payload.mediaType,
      size: payload.size,
      metadata: {
        originalFilename: payload.filename,
      },
    },
  );

  if (uploadResult.isErr()) {
    // Upload failed - update cache to failed state
    const failedState: UploadState = {
      ...uploadState,
      state: "failed",
      error: uploadResult.error.message,
      updatedAt: new Date(),
    };

    await uploadStateCache.set(
      ctx,
      uploadStateId,
      failedState,
      uploadStateTtlSeconds,
    );

    logger.error("Stream upload failed", uploadResult.error, {
      fileId: payload.id,
      objectKey,
    });

    // Return a FileAsset with failed state (not an error - caller gets FileAsset)
    const fileAsset: FileAsset = {
      id: payload.id,
      state: "failed",
      filename: sanitizedFilename,
      originalFilename: payload.filename,
      mediaType: payload.mediaType,
      size: payload.size,
      error: uploadResult.error.message,
      createdAt: now,
    };

    return ok(fileAsset);
  }

  // Upload succeeded - delete cache state
  await uploadStateCache.del(ctx, uploadStateId);

  logger.info("Stream upload completed", {
    fileId: payload.id,
    objectKey,
    size: payload.size,
  });

  const fileAsset: FileAsset = {
    id: payload.id,
    state: "ready",
    filename: sanitizedFilename,
    originalFilename: payload.filename,
    mediaType: payload.mediaType,
    size: payload.size,
    createdAt: now,
  };

  return ok(fileAsset);
}
