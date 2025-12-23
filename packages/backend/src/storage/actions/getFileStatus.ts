import type { Context } from '@backend/infrastructure/context';
import type { FileAsset } from '@core/domain/file';
import { fileAssetIdSchema } from '@core/domain/file';
import { notFound } from '@core/errors';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import { UploadStateId } from '../cache/domain/UploadState';
import type { IUploadStateCache } from '../cache/domain/UploadStateCache';
import type { IStorageProvider } from '../domain/StorageProvider';
import type { GetFileStatusRequest } from '../domain/StorageTypes';
import { buildObjectKey } from './buildObjectKey';

export interface GetFileStatusDeps {
  readonly storageProvider: IStorageProvider;
  readonly uploadStateCache: IUploadStateCache;
}

export async function getFileStatus(
  ctx: Context,
  request: GetFileStatusRequest,
  deps: GetFileStatusDeps,
): Promise<Result<FileAsset, AppError>> {
  const { storageProvider, uploadStateCache } = deps;

  const fileIdResult = validate(fileAssetIdSchema, request.fileId);
  if (fileIdResult.isErr()) {
    return err(fileIdResult.error);
  }
  const fileId = fileIdResult.value;
  const objectKey = buildObjectKey(request.folder, fileId, request.filename);

  // 1. Check storage first (source of truth for 'ready')
  const metadataResult = await storageProvider.getMetadata(objectKey);

  if (metadataResult.isErr()) {
    return err(metadataResult.error);
  }

  const metadata = metadataResult.value;
  if (metadata) {
    // File exists in storage
    const fileAsset: FileAsset = {
      id: fileId,
      state: 'ready',
      mediaType: metadata.contentType,
      size: metadata.size,
      checksum: metadata.metadata?.checksum,
      createdAt: metadata.updatedAt,
    };
    return ok(fileAsset);
  }

  // 2. Check cache for upload state
  const uploadStateId = UploadStateId(fileId);
  const cacheResult = await uploadStateCache.get(ctx, uploadStateId);

  if (cacheResult.isErr()) {
    // Cache miss or error - if error code is NotFound, file doesn't exist
    if (cacheResult.error.code === 'NotFound') {
      return err(
        notFound('File not found', {
          metadata: { fileId, objectKey },
        }),
      );
    }
    return err(cacheResult.error);
  }

  const cacheState = cacheResult.value;
  if (cacheState) {
    const fileAsset: FileAsset = {
      id: fileId,
      state: cacheState.state,
      mediaType: cacheState.mediaType,
      size: cacheState.size,
      checksum: cacheState.checksum,
      error: cacheState.error,
      createdAt: cacheState.createdAt,
    };
    return ok(fileAsset);
  }

  // 3. Not in storage, not in cache - not found
  return err(
    notFound('File not found', {
      metadata: { fileId, objectKey },
    }),
  );
}
