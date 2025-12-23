import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { FileAsset, FileAssetId } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import {
  UPLOAD_STATE_SCHEMA_VERSION,
  type UploadState,
  UploadStateId,
} from '../cache/domain/UploadState';
import type { IUploadStateCache } from '../cache/domain/UploadStateCache';
import type { IStorageProvider } from '../domain/StorageProvider';
import type {
  GetUploadUrlRequest,
  UploadUrlResponse,
} from '../domain/StorageTypes';
import { buildObjectKey, sanitizeFilename } from './buildObjectKey';

export interface GetUploadUrlDeps {
  readonly storageProvider: IStorageProvider;
  readonly uploadStateCache: IUploadStateCache;
  readonly logger: ILogger;
  readonly signedUrlExpirationSeconds: number;
  readonly uploadStateTtlSeconds: number;
  readonly newFileAssetId: () => FileAssetId;
}

export async function getUploadUrl(
  ctx: Context,
  request: GetUploadUrlRequest,
  deps: GetUploadUrlDeps,
): Promise<Result<UploadUrlResponse, AppError>> {
  const {
    storageProvider,
    uploadStateCache,
    logger,
    signedUrlExpirationSeconds,
    uploadStateTtlSeconds,
    newFileAssetId,
  } = deps;

  // Generate file ID
  const fileId = newFileAssetId();
  const sanitizedFilename = sanitizeFilename(request.filename);
  const objectKey = buildObjectKey(request.folder, fileId, request.filename);

  logger.debug('Generating upload URL', {
    fileId,
    objectKey,
    size: request.size,
  });

  // Generate signed URL for upload
  const signedUrlResult = await storageProvider.getSignedUploadUrl(objectKey, {
    contentType: request.mediaType,
    expiresInSeconds: signedUrlExpirationSeconds,
  });

  if (signedUrlResult.isErr()) {
    return err(signedUrlResult.error);
  }

  // Create upload state in cache
  const uploadStateId = UploadStateId(fileId);
  const now = new Date();
  const uploadState: UploadState = {
    id: uploadStateId,
    folder: request.folder,
    filename: request.filename,
    sanitizedFilename,
    mediaType: request.mediaType,
    size: request.size,
    state: 'uploading',
    createdAt: now,
    schemaVersion: UPLOAD_STATE_SCHEMA_VERSION,
  };

  const cacheResult = await uploadStateCache.set(
    ctx,
    uploadStateId,
    uploadState,
    uploadStateTtlSeconds,
  );

  if (cacheResult.isErr()) {
    return err(cacheResult.error);
  }

  // Build response
  const expiresAt = new Date(
    Date.now() + signedUrlExpirationSeconds * 1000,
  ).toISOString();

  const fileAsset: FileAsset = {
    id: fileId,
    state: 'uploading',
    filename: sanitizedFilename,
    originalFilename: request.filename,
    mediaType: request.mediaType,
    size: request.size,
    createdAt: now,
  };

  return ok({
    fileAsset,
    uploadUrl: signedUrlResult.value,
    expiresAt,
  });
}
