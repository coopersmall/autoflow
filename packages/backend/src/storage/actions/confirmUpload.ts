import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { FileAsset } from '@core/domain/file';
import { fileAssetIdSchema } from '@core/domain/file';
import { notFound } from '@core/errors';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import { type UploadState, UploadStateId } from '../cache/domain/UploadState';
import type { IUploadStateCache } from '../cache/domain/UploadStateCache';
import type { IStorageProvider } from '../domain/StorageProvider';
import type { ConfirmUploadRequest } from '../domain/StorageTypes';
import { buildObjectKey } from './buildObjectKey';

export interface ConfirmUploadDeps {
  readonly storageProvider: IStorageProvider;
  readonly uploadStateCache: IUploadStateCache;
  readonly logger: ILogger;
  readonly uploadStateTtlSeconds: number;
}

export async function confirmUpload(
  ctx: Context,
  request: ConfirmUploadRequest,
  deps: ConfirmUploadDeps,
): Promise<Result<FileAsset, AppError>> {
  const { storageProvider, uploadStateCache, logger, uploadStateTtlSeconds } =
    deps;

  const fileIdResult = validate(fileAssetIdSchema, request.fileId);
  if (fileIdResult.isErr()) {
    return err(fileIdResult.error);
  }
  const fileId = fileIdResult.value;
  const objectKey = buildObjectKey(request.folder, fileId, request.filename);

  logger.debug('Confirming upload', { fileId, objectKey });

  // Check if file exists in storage
  const existsResult = await storageProvider.exists(objectKey);

  if (existsResult.isErr()) {
    return err(existsResult.error);
  }

  const uploadStateId = UploadStateId(fileId);

  if (!existsResult.value) {
    // File doesn't exist - update cache to failed state
    const cacheResult = await uploadStateCache.get(ctx, uploadStateId);

    if (cacheResult.isOk() && cacheResult.value) {
      const failedState: UploadState = {
        ...cacheResult.value,
        state: 'failed',
        error: 'File not found in storage after upload',
        updatedAt: new Date(),
      };
      await uploadStateCache.set(
        ctx,
        uploadStateId,
        failedState,
        uploadStateTtlSeconds,
      );
    }

    return err(
      notFound('File not found in storage', {
        metadata: { fileId, objectKey },
      }),
    );
  }

  // File exists - delete cache state (storage is now source of truth)
  await uploadStateCache.del(ctx, uploadStateId);

  // Get file metadata from storage to build FileAsset
  const metadataResult = await storageProvider.getMetadata(objectKey);

  if (metadataResult.isErr()) {
    return err(metadataResult.error);
  }

  const metadata = metadataResult.value;
  if (!metadata) {
    return err(
      notFound('File metadata not found', {
        metadata: { fileId, objectKey },
      }),
    );
  }

  const fileAsset: FileAsset = {
    id: fileId,
    state: 'ready',
    mediaType: metadata.contentType,
    size: metadata.size,
    checksum: metadata.metadata?.checksum,
    createdAt: metadata.updatedAt,
  };

  logger.info('Upload confirmed', { fileId, objectKey });

  return ok(fileAsset);
}
