import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { FileAsset } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';
import {
  UPLOAD_STATE_SCHEMA_VERSION,
  type UploadState,
  UploadStateId,
} from '../cache/domain/UploadState';
import type { IUploadStateCache } from '../cache/domain/UploadStateCache';
import type { IStorageProvider } from '../domain/StorageProvider';
import type { UploadStreamRequest } from '../domain/StorageTypes';
import { buildObjectKey } from './buildObjectKey';

export interface UploadStreamDeps {
  readonly storageProvider: IStorageProvider;
  readonly uploadStateCache: IUploadStateCache;
  readonly logger: ILogger;
  readonly uploadStateTtlSeconds: number;
}

/**
 * Upload a file from a stream.
 *
 * Uses GCS resumable uploads with progress tracking.
 * Updates cache after each chunk for progress polling.
 * Auto-cleanup on failure.
 */
export async function uploadStream(
  ctx: Context,
  request: UploadStreamRequest,
  deps: UploadStreamDeps,
): Promise<Result<FileAsset, AppError>> {
  const { storageProvider, uploadStateCache, logger, uploadStateTtlSeconds } =
    deps;
  const { payload, folder } = request;
  const objectKey = buildObjectKey(folder, payload.id, payload.filename);
  const now = new Date();

  logger.debug('Starting stream upload', {
    fileId: payload.id,
    objectKey,
    size: payload.size ?? 'unknown',
  });

  // Create upload state in cache
  const uploadStateId = UploadStateId(payload.id);
  const uploadState: UploadState = {
    id: uploadStateId,
    folder,
    filename: payload.filename,
    mediaType: payload.mediaType,
    size: payload.size,
    state: 'uploading',
    bytesUploaded: 0,
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
      state: 'failed',
      mediaType: payload.mediaType,
      size: payload.size ?? 0,
      error: cacheSetResult.error.message,
      createdAt: now,
    };
    return ok(fileAsset);
  }

  // Upload with progress callback
  const uploadResult = await storageProvider.putStream(
    objectKey,
    payload.stream,
    {
      contentType: payload.mediaType,
      size: payload.size,
      metadata: {
        originalFilename: payload.filename,
      },
      onProgress: async (bytesUploaded: number) => {
        // Update cache with progress
        const updatedState: UploadState = {
          ...uploadState,
          bytesUploaded,
          updatedAt: new Date(),
        };

        await uploadStateCache.set(
          ctx,
          uploadStateId,
          updatedState,
          uploadStateTtlSeconds,
        );

        logger.debug('Upload progress', {
          fileId: payload.id,
          bytesUploaded,
          totalSize: payload.size,
        });
      },
    },
  );

  if (uploadResult.isErr()) {
    // Upload failed - update cache to failed state
    const failedState: UploadState = {
      ...uploadState,
      state: 'failed',
      error: uploadResult.error.message,
      updatedAt: new Date(),
    };

    await uploadStateCache.set(
      ctx,
      uploadStateId,
      failedState,
      uploadStateTtlSeconds,
    );

    logger.error('Stream upload failed', uploadResult.error, {
      fileId: payload.id,
      objectKey,
    });

    // Return a FileAsset with failed state (not an error - caller gets FileAsset)
    const fileAsset: FileAsset = {
      id: payload.id,
      state: 'failed',
      mediaType: payload.mediaType,
      size: payload.size ?? 0,
      error: uploadResult.error.message,
      createdAt: now,
    };

    return ok(fileAsset);
  }

  // Upload succeeded - delete cache state
  await uploadStateCache.del(ctx, uploadStateId);

  logger.info('Stream upload completed', {
    fileId: payload.id,
    objectKey,
    size: payload.size,
  });

  const fileAsset: FileAsset = {
    id: payload.id,
    state: 'ready',
    mediaType: payload.mediaType,
    size: payload.size ?? 0,
    createdAt: now,
  };

  return ok(fileAsset);
}
