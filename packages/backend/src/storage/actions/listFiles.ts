import type { Context } from '@backend/infrastructure/context';
import type { FileAsset } from '@core/domain/file';
import { FileAssetId } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import type { IStorageProvider } from '../domain/StorageProvider';
import type {
  ListFilesRequest,
  ListFilesResponse,
} from '../domain/StorageTypes';

export interface ListFilesDeps {
  readonly storageProvider: IStorageProvider;
}

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
    // Extract fileId from object key: {folder}/{fileId}/{filename}
    const parts = obj.key.split('/');
    const fileIdStr = parts.length >= 2 ? parts[parts.length - 2] : obj.key;

    files.push({
      id: FileAssetId(fileIdStr),
      state: 'ready',
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
