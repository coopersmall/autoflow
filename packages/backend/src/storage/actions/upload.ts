import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { FileAsset } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import type { Result } from 'neverthrow';
import { err } from 'neverthrow';
import type { IUploadStateCache } from '../cache/domain/UploadStateCache';
import type { IStorageProvider } from '../domain/StorageProvider';
import type { UploadRequest } from '../domain/StorageTypes';
import { bufferToStream } from './bufferToStream';
import { type UploadStreamDeps, uploadStream } from './uploadStream';

export interface UploadDeps {
  readonly storageProvider: IStorageProvider;
  readonly uploadStateCache: IUploadStateCache;
  readonly logger: ILogger;
  readonly smallFileSizeThreshold: number;
  readonly uploadStateTtlSeconds: number;
}

/**
 * Upload a small file from a buffer.
 *
 * ENFORCES size limit (default 5MB). Rejects larger files.
 * Internally converts buffer to stream and calls uploadStream().
 */
export async function upload(
  ctx: Context,
  request: UploadRequest,
  deps: UploadDeps,
): Promise<Result<FileAsset, AppError>> {
  const { payload } = request;

  // Enforce size limit
  if (payload.size > deps.smallFileSizeThreshold) {
    const limitMB = Math.round(deps.smallFileSizeThreshold / (1024 * 1024));
    const sizeMB = Math.round(payload.size / (1024 * 1024));

    return err(
      badRequest(
        `File size exceeds limit. Maximum: ${limitMB}MB, actual: ${sizeMB}MB`,
        {
          metadata: {
            fileId: payload.id,
            size: payload.size,
            limit: deps.smallFileSizeThreshold,
          },
        },
      ),
    );
  }

  deps.logger.debug('Uploading file (buffered)', {
    correlationId: ctx.correlationId,
    fileId: payload.id,
    size: payload.size,
  });

  // Convert buffer to stream
  const stream = bufferToStream(payload.data);

  // Delegate to uploadStream
  const uploadStreamDeps: UploadStreamDeps = {
    storageProvider: deps.storageProvider,
    uploadStateCache: deps.uploadStateCache,
    logger: deps.logger,
    uploadStateTtlSeconds: deps.uploadStateTtlSeconds,
  };

  return uploadStream(
    ctx,
    {
      payload: {
        id: payload.id,
        filename: payload.filename,
        mediaType: payload.mediaType,
        size: payload.size,
        stream,
      },
      folder: request.folder,
    },
    uploadStreamDeps,
  );
}
