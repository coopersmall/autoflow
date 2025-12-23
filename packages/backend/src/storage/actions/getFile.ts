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
import type { GetFileRequest } from '../domain/StorageTypes';
import { buildObjectKey, sanitizeFilename } from './buildObjectKey';

export interface GetFileDeps {
  readonly storageProvider: IStorageProvider;
  readonly uploadStateCache: IUploadStateCache;
}

/**
 * Get the current state of a file.
 *
 * Priority order:
 * 1. Storage (source of truth for 'ready' state)
 * 2. Cache (tracks 'uploading' and 'failed' states)
 * 3. Not found
 */
export async function getFile(
  ctx: Context,
  request: GetFileRequest,
  deps: GetFileDeps,
): Promise<Result<FileAsset, AppError>> {
  const { storageProvider, uploadStateCache } = deps;

  const fileIdResult = validate(fileAssetIdSchema, request.fileId);
  if (fileIdResult.isErr()) {
    return err(fileIdResult.error);
  }
  const fileId = fileIdResult.value;
  const sanitizedFilename = sanitizeFilename(request.filename);
  const objectKey = buildObjectKey(request.folder, fileId, request.filename);

  // 1. Check storage first (source of truth for 'ready')
  const metadataResult = await storageProvider.getMetadata(objectKey);
  if (metadataResult.isErr()) {
    return err(metadataResult.error);
  }

  const metadata = metadataResult.value;
  if (metadata) {
    // originalFilename from metadata if stored, otherwise use sanitized
    const storedOriginalFilename = metadata.metadata?.originalFilename;
    return ok({
      id: fileId,
      state: 'ready',
      filename: sanitizedFilename,
      originalFilename: storedOriginalFilename ?? request.filename,
      mediaType: metadata.contentType,
      size: metadata.size,
      checksum: metadata.metadata?.checksum,
      createdAt: metadata.updatedAt,
    });
  }

  // 2. Check cache for upload state (uploading/failed)
  const uploadStateId = UploadStateId(fileId);
  const cacheResult = await uploadStateCache.get(ctx, uploadStateId);

  if (cacheResult.isErr()) {
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
    return ok({
      id: fileId,
      state: cacheState.state,
      filename: cacheState.sanitizedFilename,
      originalFilename: cacheState.filename,
      mediaType: cacheState.mediaType,
      size: cacheState.size,
      checksum: cacheState.checksum,
      error: cacheState.error,
      createdAt: cacheState.createdAt,
    });
  }

  // 3. Not in storage, not in cache
  return err(
    notFound('File not found', {
      metadata: { fileId, objectKey },
    }),
  );
}
