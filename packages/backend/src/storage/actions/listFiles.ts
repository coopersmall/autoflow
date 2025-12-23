/**
 * Action for listing files in a folder.
 *
 * This action retrieves file metadata from storage and converts it to FileAsset
 * objects. It supports pagination for large result sets.
 *
 * @module storage/actions/listFiles
 */

import type { Context } from '@backend/infrastructure/context';
import type { FileAsset } from '@core/domain/file';
import { validFileAssetId } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import type { IStorageProvider } from '../domain/StorageProvider';
import type {
  ListFilesRequest,
  ListFilesResponse,
} from '../domain/StorageTypes';

/**
 * Dependencies required by the listFiles action.
 */
export interface ListFilesDeps {
  /** Storage provider for listing operations */
  readonly storageProvider: IStorageProvider;
}

/**
 * List files in a folder.
 *
 * This action queries the storage provider for objects matching the folder prefix
 * and converts them to FileAsset objects. All returned files have state 'ready'
 * since they exist in storage (the source of truth for ready state).
 *
 * ## Object Key Structure
 *
 * Files are stored with keys in the format: `{folder}/{fileId}/{filename}`
 * This action parses object keys to extract the fileId and filename.
 *
 * ## Pagination
 *
 * For folders with many files, use `maxResults` and `pageToken` to paginate:
 * - Set `maxResults` to limit results per page
 * - Use `nextPageToken` from the response to fetch the next page
 *
 * @param ctx - Request context (unused but included for consistency)
 * @param request - List request containing folder and pagination options
 * @param deps - Dependencies (storage provider)
 * @returns ListFilesResponse with files array and optional nextPageToken
 *
 * @example
 * ```typescript
 * // List all files in a folder
 * const result = await listFiles(ctx, {
 *   folder: 'users/usr_123/documents',
 * }, deps);
 *
 * // Paginated listing
 * const page1 = await listFiles(ctx, {
 *   folder: 'users/usr_123/documents',
 *   maxResults: 50,
 * }, deps);
 *
 * if (page1.isOk() && page1.value.nextPageToken) {
 *   const page2 = await listFiles(ctx, {
 *     folder: 'users/usr_123/documents',
 *     maxResults: 50,
 *     pageToken: page1.value.nextPageToken,
 *   }, deps);
 * }
 * ```
 */
export async function listFiles(
  _ctx: Context,
  request: ListFilesRequest,
  deps: ListFilesDeps,
): Promise<Result<ListFilesResponse, AppError>> {
  const { storageProvider } = deps;

  const listResult = await storageProvider.list(request.folder, {
    maxResults: request.maxResults,
    cursor: request.pageToken,
  });

  if (listResult.isErr()) {
    return err(listResult.error);
  }

  // Convert storage objects to FileAsset, filtering out invalid entries
  const files: FileAsset[] = [];
  for (const obj of listResult.value.objects) {
    // Extract fileId and filename from object key: {folder}/{fileId}/{filename}
    const parts = obj.key.split('/');
    const fileIdStr = parts.length >= 2 ? parts[parts.length - 2] : obj.key;
    const filename = parts.length >= 1 ? parts[parts.length - 1] : obj.key;

    const validFileId = validFileAssetId(fileIdStr);
    if (validFileId.isErr()) {
      return err(validFileId.error);
    }

    const fileId = validFileId.value;

    // originalFilename from metadata if stored, otherwise use filename from key
    const originalFilename = obj.metadata?.originalFilename ?? filename;

    files.push({
      id: fileId,
      state: 'ready',
      filename,
      originalFilename,
      mediaType: obj.contentType,
      size: obj.size,
      checksum: obj.metadata?.checksum,
      createdAt: obj.updatedAt,
    });
  }

  return ok({
    files,
    nextPageToken: listResult.value.nextCursor,
  });
}
