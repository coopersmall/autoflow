import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { FileReferenceReady } from '@core/domain/file';
import { fileAssetIdSchema } from '@core/domain/file';
import { notFound } from '@core/errors';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import type { IStorageProvider } from '../domain/StorageProvider';
import type { GetDownloadUrlRequest } from '../domain/StorageTypes';
import { buildObjectKey } from './buildObjectKey';

export interface GetDownloadUrlDeps {
  readonly storageProvider: IStorageProvider;
  readonly logger: ILogger;
  readonly signedUrlExpirationSeconds: number;
}

export async function getDownloadUrl(
  ctx: Context,
  request: GetDownloadUrlRequest,
  deps: GetDownloadUrlDeps,
): Promise<Result<FileReferenceReady, AppError>> {
  const { storageProvider, logger, signedUrlExpirationSeconds } = deps;

  const fileIdResult = validate(fileAssetIdSchema, request.fileId);
  if (fileIdResult.isErr()) {
    return err(fileIdResult.error);
  }
  const fileId = fileIdResult.value;
  const objectKey = buildObjectKey(request.folder, fileId, request.filename);
  const expiresInSeconds =
    request.expiresInSeconds ?? signedUrlExpirationSeconds;

  // Get file metadata (also confirms existence)
  const metadataResult = await storageProvider.getMetadata(objectKey);

  if (metadataResult.isErr()) {
    return err(metadataResult.error);
  }

  const metadata = metadataResult.value;
  if (!metadata) {
    return err(
      notFound('File not found', {
        metadata: { fileId, objectKey },
      }),
    );
  }

  // Generate signed URL
  const signedUrlResult = await storageProvider.getSignedDownloadUrl(
    objectKey,
    expiresInSeconds,
  );

  if (signedUrlResult.isErr()) {
    return err(signedUrlResult.error);
  }

  logger.debug('Generated download URL', {
    correlationId: ctx.correlationId,
    fileId,
    objectKey,
  });

  const fileReference: FileReferenceReady = {
    status: 'ready',
    id: fileId,
    url: signedUrlResult.value,
    mediaType: metadata.contentType,
    size: metadata.size,
  };

  return ok(fileReference);
}
