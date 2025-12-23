/**
 * Upload action for buffered file uploads.
 *
 * This action handles synchronous uploads of small files from memory buffers.
 * It enforces a size limit and internally delegates to uploadStream() for
 * the actual upload operation.
 *
 * @module storage/actions/upload
 */

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

/**
 * Dependencies required by the upload action.
 */
export interface UploadDeps {
  /** Storage provider for file operations */
  readonly storageProvider: IStorageProvider;
  /** Cache for tracking upload state */
  readonly uploadStateCache: IUploadStateCache;
  /** Logger for debugging and error reporting */
  readonly logger: ILogger;
  /** Maximum file size in bytes for buffered upload (default: 5MB) */
  readonly smallFileSizeThreshold: number;
  /** TTL in seconds for upload state in cache */
  readonly uploadStateTtlSeconds: number;
}

/**
 * Upload a file from a buffer.
 *
 * This is a convenience method for small files that fit in memory.
 * It enforces a size limit (default 5MB) and rejects larger files
 * with a BadRequest error.
 *
 * Internally, it converts the buffer to a stream and delegates to
 * uploadStream() for the actual upload. This ensures consistent
 * behavior and state management across all upload methods.
 *
 * @param ctx - Request context for correlation and tracing
 * @param request - Upload request containing file payload and folder
 * @param deps - Dependencies (storage provider, cache, logger, etc.)
 * @returns FileAsset with 'ready' state on success, or error
 *
 * @example
 * ```typescript
 * const result = await upload(ctx, {
 *   payload: {
 *     id: FileAssetId(),
 *     filename: 'document.pdf',
 *     mediaType: 'application/pdf',
 *     data: new Uint8Array(buffer),
 *     size: buffer.length,
 *   },
 *   folder: 'users/usr_123/documents',
 * }, deps);
 *
 * if (result.isOk()) {
 *   console.log('Uploaded:', result.value.id);
 * }
 * ```
 *
 * @see uploadStream - For large files or streaming uploads
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
