/**
 * Action for generating signed download URLs.
 *
 * This action creates pre-signed URLs that allow clients to download files
 * directly from cloud storage without proxying through the application server.
 *
 * @module storage/actions/getDownloadUrl
 */

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

/**
 * Dependencies required by the getDownloadUrl action.
 */
export interface GetDownloadUrlDeps {
  /** Storage provider for generating signed URLs */
  readonly storageProvider: IStorageProvider;
  /** Logger for debugging */
  readonly logger: ILogger;
  /** Default expiration time for signed URLs in seconds */
  readonly signedUrlExpirationSeconds: number;
}

/**
 * Generate a signed URL for downloading a file.
 *
 * This action verifies the file exists in storage before generating a download URL.
 * The signed URL allows direct access to the file for a limited time without
 * requiring authentication.
 *
 * ## Security
 *
 * - Signed URLs are time-limited (configurable via `expiresInSeconds`)
 * - The URL grants read-only access to the specific file
 * - No authentication is required to use the signed URL
 *
 * ## Use Cases
 *
 * - Serving files to authenticated users without proxying
 * - Generating temporary download links for sharing
 * - Streaming large files directly from storage
 *
 * @param ctx - Request context for correlation and tracing
 * @param request - Request containing fileId, folder, filename, and optional expiresInSeconds
 * @param deps - Dependencies (storage provider, logger, expiration config)
 * @returns FileReferenceReady with signed download URL, or NotFound error
 *
 * @example
 * ```typescript
 * const result = await getDownloadUrl(ctx, {
 *   fileId: 'file_abc123',
 *   folder: 'users/usr_123/documents',
 *   filename: 'report.pdf',
 *   expiresInSeconds: 3600, // 1 hour (optional)
 * }, deps);
 *
 * if (result.isOk()) {
 *   // Return URL to client for download
 *   return { downloadUrl: result.value.url };
 * }
 * ```
 */
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
