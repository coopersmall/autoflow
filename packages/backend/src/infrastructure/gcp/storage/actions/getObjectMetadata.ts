import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import type {
  GetMetadataRequest,
  GetMetadataResponse,
} from '../domain/StorageTypes';
import { mapStorageError } from './storageInterfaces';

/**
 * Gets metadata for a single object in GCS.
 * Returns null if the object does not exist (not an error).
 *
 * @param request - Request with bucket and object name
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with metadata or null if not found
 *
 * @example
 * ```typescript
 * const result = await getObjectMetadata(
 *   { bucketName: 'my-bucket', objectName: 'path/to/file.txt' },
 *   storage,
 *   logger,
 * );
 *
 * if (result.isOk() && result.value !== null) {
 *   console.log(`File size: ${result.value.size}`);
 * }
 * ```
 */
export async function getObjectMetadata(
  request: GetMetadataRequest,
  storage: Storage,
  logger: ILogger,
): Promise<Result<GetMetadataResponse | null, AppError>> {
  const { bucketName, objectName } = request;

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (!exists) {
      return ok(null);
    }

    const [metadata] = await file.getMetadata();

    return ok({
      name: objectName,
      size: Number(metadata.size ?? 0),
      contentType: metadata.contentType ?? 'application/octet-stream',
      updated: new Date(metadata.updated ?? Date.now()),
      etag: metadata.etag,
      metadata: parseCustomMetadata(metadata.metadata),
    });
  } catch (e) {
    return err(
      mapStorageError(e, bucketName, objectName, 'getMetadata', logger),
    );
  }
}

/**
 * Safely parses custom metadata from GCS response.
 * GCS returns metadata as Record<string, string> but typed as unknown.
 */
function parseCustomMetadata(
  metadata?: Record<string, string | boolean | number | null>,
): Record<string, string> | undefined {
  if (metadata === null || metadata === undefined) {
    return undefined;
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      result[key] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
