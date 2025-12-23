/**
 * Action for retrieving file state.
 *
 * This action determines the current state of a file by checking both
 * storage and cache. It implements the state derivation logic that is
 * central to the storage service's design.
 *
 * @module storage/actions/getFile
 */

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

/**
 * Dependencies required by the getFile action.
 */
export interface GetFileDeps {
  /** Storage provider for checking file existence and metadata */
  readonly storageProvider: IStorageProvider;
  /** Cache for checking upload state */
  readonly uploadStateCache: IUploadStateCache;
}

/**
 * Get the current state of a file.
 *
 * This action implements the core state derivation logic for files:
 *
 * ## State Resolution Priority
 *
 * 1. **Storage** - If file exists in storage, state is 'ready'
 * 2. **Cache** - If file has cached state, return 'uploading' or 'failed'
 * 3. **Not found** - If not in storage or cache, return NotFound error
 *
 * ## Design Rationale
 *
 * Storage is checked first because it's the source of truth for completed uploads.
 * Once a file is successfully uploaded, its cache entry is deleted. Checking
 * storage first ensures we always return 'ready' for files that exist, even if
 * stale cache entries remain.
 *
 * The cache only tracks transient states (uploading, failed) for files that
 * haven't completed their upload lifecycle.
 *
 * @param ctx - Request context for correlation and tracing
 * @param request - Request containing fileId, folder, and filename
 * @param deps - Dependencies (storage provider, upload state cache)
 * @returns FileAsset with current state, or NotFound error
 *
 * @example
 * ```typescript
 * const result = await getFile(ctx, {
 *   fileId: 'file_abc123',
 *   folder: 'users/usr_123/documents',
 *   filename: 'report.pdf',
 * }, deps);
 *
 * if (result.isOk()) {
 *   switch (result.value.state) {
 *     case 'ready':
 *       // File is uploaded and accessible
 *       break;
 *     case 'uploading':
 *       // Upload in progress
 *       break;
 *     case 'failed':
 *       // Upload failed, check result.value.error
 *       break;
 *   }
 * }
 * ```
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
