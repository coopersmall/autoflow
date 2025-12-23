import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { fileAssetIdSchema } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import { UploadStateId } from '../cache/domain/UploadState';
import type { IUploadStateCache } from '../cache/domain/UploadStateCache';
import type { IStorageProvider } from '../domain/StorageProvider';
import type { DeleteFileRequest } from '../domain/StorageTypes';
import { buildObjectKey } from './buildObjectKey';

export interface DeleteFileDeps {
  readonly storageProvider: IStorageProvider;
  readonly uploadStateCache: IUploadStateCache;
  readonly logger: ILogger;
}

export async function deleteFile(
  ctx: Context,
  request: DeleteFileRequest,
  deps: DeleteFileDeps,
): Promise<Result<void, AppError>> {
  const { storageProvider, uploadStateCache, logger } = deps;

  const fileIdResult = validate(fileAssetIdSchema, request.fileId);
  if (fileIdResult.isErr()) {
    return err(fileIdResult.error);
  }
  const fileId = fileIdResult.value;
  const objectKey = buildObjectKey(request.folder, fileId, request.filename);

  logger.debug('Deleting file', { fileId, objectKey });

  // Delete from storage
  const deleteResult = await storageProvider.delete(objectKey);

  if (deleteResult.isErr()) {
    return err(deleteResult.error);
  }

  // Delete from cache (if exists)
  const uploadStateId = UploadStateId(fileId);
  await uploadStateCache.del(ctx, uploadStateId);

  logger.info('File deleted', { fileId, objectKey });

  return ok(undefined);
}
