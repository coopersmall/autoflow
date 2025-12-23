import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import { gcsObjectNotFound } from '../../errors/gcpErrors';
import type { DownloadRequest } from '../domain/StorageTypes';
import { getErrorCode, mapStorageError } from './storageInterfaces';

/**
 * Downloads an object from GCS to a Buffer.
 *
 * @param request - Download request with bucket and object name
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with Buffer or error
 *
 * @example
 * ```typescript
 * const result = await downloadObject(
 *   { bucketName: 'my-bucket', objectName: 'path/to/file.txt' },
 *   storage,
 *   logger,
 * );
 * ```
 */
export async function downloadObject(
  request: DownloadRequest,
  storage: Storage,
  logger: ILogger,
): Promise<Result<Buffer, AppError>> {
  const { bucketName, objectName } = request;

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    const [contents] = await file.download();

    return ok(contents);
  } catch (e) {
    const errorCode = getErrorCode(e);

    if (errorCode === 404) {
      return err(
        gcsObjectNotFound(`Object not found: ${objectName}`, {
          cause: e,
          bucket: bucketName,
          objectName,
        }),
      );
    }

    return err(mapStorageError(e, bucketName, objectName, 'download', logger));
  }
}
