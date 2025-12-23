/**
 * Action for generating signed upload URLs for client-side uploads.
 *
 * This action enables direct-to-storage uploads from clients (browsers, mobile apps)
 * by generating pre-signed URLs. The client can then upload directly to cloud storage
 * without proxying through the application server.
 *
 * @module storage/actions/getUploadUrl
 */

import type { Context } from "@backend/infrastructure/context";
import type { ILogger } from "@backend/infrastructure/logger/Logger";
import type { FileAsset, FileAssetId } from "@core/domain/file";
import type { AppError } from "@core/errors/AppError";
import { err, ok, type Result } from "neverthrow";
import {
  UPLOAD_STATE_SCHEMA_VERSION,
  type UploadState,
  UploadStateId,
} from "../cache/domain/UploadState";
import type { IUploadStateCache } from "../cache/domain/UploadStateCache";
import type { IStorageProvider } from "../domain/StorageProvider";
import type {
  GetUploadUrlRequest,
  UploadUrlResponse,
} from "../domain/StorageTypes";
import { buildObjectKey, validateAndSanitizeFilename } from "./buildObjectKey";

/**
 * Dependencies required by the getUploadUrl action.
 */
export interface GetUploadUrlDeps {
  /** Storage provider for generating signed URLs */
  readonly storageProvider: IStorageProvider;
  /** Cache for tracking upload state */
  readonly uploadStateCache: IUploadStateCache;
  /** Logger for debugging and error reporting */
  readonly logger: ILogger;
  /** Expiration time for signed URLs in seconds */
  readonly signedUrlExpirationSeconds: number;
  /** TTL in seconds for upload state in cache */
  readonly uploadStateTtlSeconds: number;
  /** Factory function to generate new FileAssetIds */
  readonly newFileAssetId: () => FileAssetId;
}

/**
 * Generate a signed URL for client-side file upload.
 *
 * This action is used when clients need to upload files directly to cloud storage
 * without proxying through the application server. It:
 *
 * 1. Generates a new FileAssetId
 * 2. Validates and sanitizes the filename
 * 3. Creates a signed upload URL
 * 4. Records the upload state in cache (state: 'uploading')
 *
 * ## Client Upload Flow
 *
 * ```
 * Client                    Server                    GCS
 *   |-- getUploadUrl() ------>|                         |
 *   |<-- {uploadUrl, ...} ----|                         |
 *   |                         |                         |
 *   |-------------- PUT uploadUrl -------------------- >|
 *   |<------------- 200 OK ----------------------------|
 *   |                         |                         |
 *   |-- confirmUpload() ---->|-- getFile() checks ---->|
 * ```
 *
 * ## Important Notes
 *
 * - The signed URL expires after `signedUrlExpirationSeconds`
 * - The upload state is tracked in cache with the configured TTL
 * - The filename is sanitized to prevent path traversal attacks
 * - The original filename is preserved in the FileAsset for display
 *
 * @param ctx - Request context for correlation and tracing
 * @param request - Request containing folder, filename, mediaType, and size
 * @param deps - Dependencies (storage provider, cache, logger, etc.)
 * @returns UploadUrlResponse with FileAsset, uploadUrl, and expiresAt
 *
 * @example
 * ```typescript
 * const result = await getUploadUrl(ctx, {
 *   folder: 'users/usr_123/uploads',
 *   filename: 'profile-photo.jpg',
 *   mediaType: 'image/jpeg',
 *   size: 1024000,
 * }, deps);
 *
 * if (result.isOk()) {
 *   const { uploadUrl, fileAsset, expiresAt } = result.value;
 *   // Return to client for direct upload
 * }
 * ```
 */
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

  // Validate and sanitize filename
  const sanitizedResult = validateAndSanitizeFilename(request.filename);
  if (sanitizedResult.isErr()) {
    return err(sanitizedResult.error);
  }
  const sanitizedFilename = sanitizedResult.value;

  const objectKey = buildObjectKey(request.folder, fileId, request.filename);

  logger.debug("Generating upload URL", {
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
    state: "uploading",
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
    state: "uploading",
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
