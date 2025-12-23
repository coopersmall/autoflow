import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import type { ListRequest, ListResponse } from '../domain/StorageTypes';
import { mapStorageError } from './storageInterfaces';

/**
 * Lists objects in a GCS bucket with optional prefix filter.
 *
 * @param request - List request with bucket and optional filters
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with list response or error
 *
 * @example
 * ```typescript
 * const result = await listObjects(
 *   { bucketName: 'my-bucket', prefix: 'uploads/', maxResults: 100 },
 *   storage,
 *   logger,
 * );
 *
 * if (result.isOk()) {
 *   for (const file of result.value.files) {
 *     console.log(file.name);
 *   }
 * }
 * ```
 */
export async function listObjects(
  request: ListRequest,
  storage: Storage,
  logger: ILogger,
): Promise<Result<ListResponse, AppError>> {
  const { bucketName, prefix, maxResults, pageToken } = request;

  try {
    const bucket = storage.bucket(bucketName);

    const [files, , apiResponse] = await bucket.getFiles({
      prefix,
      maxResults,
      pageToken,
      autoPaginate: false,
    });

    const fileInfos = await Promise.all(
      files.map(async (file) => {
        const [metadata] = await file.getMetadata();
        return {
          name: file.name,
          size: Number(metadata.size ?? 0),
          contentType: metadata.contentType ?? 'application/octet-stream',
          updated: new Date(metadata.updated ?? Date.now()),
          etag: metadata.etag,
        };
      }),
    );

    return ok({
      files: fileInfos,
      nextPageToken: getNextPageToken(apiResponse),
    });
  } catch (e) {
    return err(mapStorageError(e, bucketName, undefined, 'list', logger));
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getNextPageToken(apiResponse: unknown): string | undefined {
  if (
    apiResponse !== null &&
    typeof apiResponse === 'object' &&
    'nextPageToken' in apiResponse &&
    typeof apiResponse.nextPageToken === 'string'
  ) {
    return apiResponse.nextPageToken;
  }
  return undefined;
}
