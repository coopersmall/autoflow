/**
 * Action for deleting files from storage.
 *
 * This action removes files from both cloud storage and the upload state cache.
 * It verifies the file exists before deletion and returns NotFound if it doesn't.
 *
 * @module storage/actions/deleteFile
 */

import type { Context } from "@backend/infrastructure/context";
import type { ILogger } from "@backend/infrastructure/logger/Logger";
import { fileAssetIdSchema } from "@core/domain/file";
import type { AppError } from "@core/errors/AppError";
import { notFound } from "@core/errors/factories";
import { validate } from "@core/validation/validate";
import { err, ok, type Result } from "neverthrow";
import { UploadStateId } from "../cache/domain/UploadState";
import type { IUploadStateCache } from "../cache/domain/UploadStateCache";
import type { IStorageProvider } from "../domain/StorageProvider";
import type { DeleteFileRequest } from "../domain/StorageTypes";
import { buildObjectKey } from "./buildObjectKey";

/**
 * Dependencies required by the deleteFile action.
 */
export interface DeleteFileDeps {
  /** Storage provider for file operations */
  readonly storageProvider: IStorageProvider;
  /** Cache for tracking upload state (to clean up on delete) */
  readonly uploadStateCache: IUploadStateCache;
  /** Logger for debugging and error reporting */
  readonly logger: ILogger;
}

/**
 * Delete a file from storage and cache.
 *
 * This action performs the following steps:
 * 1. Validates the file ID format
 * 2. Checks if the file exists in storage (returns NotFound if not)
 * 3. Deletes the file from storage
 * 4. Removes any associated upload state from cache
 *
 * ## Error Handling
 *
 * Unlike the storage provider's delete (which is idempotent), this action
 * returns a NotFound error if the file doesn't exist. This helps callers
 * detect when they're trying to delete something that was already deleted
 * or never existed.
 *
 * @param ctx - Request context for correlation and tracing
 * @param request - Delete request containing fileId, folder, and filename
 * @param deps - Dependencies (storage provider, cache, logger)
 * @returns void on success, or NotFound/other error
 *
 * @example
 * ```typescript
 * const result = await deleteFile(ctx, {
 *   fileId: 'file_abc123',
 *   folder: 'users/usr_123/documents',
 *   filename: 'old-document.pdf',
 * }, deps);
 *
 * if (result.isErr() && result.error.code === 'NotFound') {
 *   console.log('File was already deleted');
 * }
 * ```
 */
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

  logger.debug("Deleting file", { fileId, objectKey });

  // Check if file exists before deleting
  const existsResult = await storageProvider.exists(objectKey);
  if (existsResult.isErr()) {
    return err(existsResult.error);
  }

  if (!existsResult.value) {
    return err(
      notFound("File not found", {
        metadata: {
          fileId,
          folder: request.folder,
          filename: request.filename,
        },
      }),
    );
  }

  // Delete from storage
  const deleteResult = await storageProvider.delete(objectKey);

  if (deleteResult.isErr()) {
    return err(deleteResult.error);
  }

  // Delete from cache (if exists)
  const uploadStateId = UploadStateId(fileId);
  await uploadStateCache.del(ctx, uploadStateId);

  logger.info("File deleted", { fileId, objectKey });

  return ok(undefined);
}
