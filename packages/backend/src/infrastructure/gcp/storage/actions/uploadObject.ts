import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import type { UploadRequest, UploadResponse } from '../domain/StorageTypes';
import { mapStorageError } from './storageInterfaces';

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/**
 * Uploads a Buffer to GCS.
 *
 * @param request - Upload request with bucket, object name, and data
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with upload response or error
 *
 * @example
 * ```typescript
 * const result = await uploadObject(
 *   { bucketName: 'my-bucket', objectName: 'path/to/file.txt', data: buffer },
 *   storage,
 *   logger,
 * );
 * ```
 */
export async function uploadObject(
  request: UploadRequest,
  storage: Storage,
  logger: ILogger,
): Promise<Result<UploadResponse, AppError>> {
  const { bucketName, objectName, data, contentType, metadata } = request;

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.save(data, {
      contentType: contentType ?? DEFAULT_CONTENT_TYPE,
      metadata,
    });

    const [fileMetadata] = await file.getMetadata();

    return ok({
      bucketName,
      objectName,
      size: data.length,
      contentType: fileMetadata.contentType ?? DEFAULT_CONTENT_TYPE,
      etag: fileMetadata.etag,
      generation: fileMetadata.generation?.toString(),
    });
  } catch (e) {
    return err(mapStorageError(e, bucketName, objectName, 'upload', logger));
  }
}
