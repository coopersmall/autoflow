import type { Readable } from 'node:stream';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import { gcsObjectNotFound } from '../../errors/gcpErrors';
import type { DownloadStreamRequest } from '../domain/StorageTypes';
import { mapStorageError } from './storageInterfaces';

/**
 * Downloads an object from GCS as a Readable stream (for large files).
 *
 * @param request - Download request with bucket and object name
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with Readable stream or error
 *
 * @example
 * ```typescript
 * const result = await downloadObjectStream(
 *   { bucketName: 'my-bucket', objectName: 'path/to/file.txt' },
 *   storage,
 *   logger,
 * );
 *
 * if (result.isOk()) {
 *   result.value.pipe(fs.createWriteStream('local-file.txt'));
 * }
 * ```
 */
export async function downloadObjectStream(
  request: DownloadStreamRequest,
  storage: Storage,
  logger: ILogger,
): Promise<Result<Readable, AppError>> {
  const { bucketName, objectName } = request;

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    // Check if file exists before creating stream
    const [exists] = await file.exists();

    if (!exists) {
      return err(
        gcsObjectNotFound(`Object not found: ${objectName}`, {
          bucket: bucketName,
          objectName,
        }),
      );
    }

    const readStream = file.createReadStream();

    return ok(readStream);
  } catch (e) {
    return err(mapStorageError(e, bucketName, objectName, 'download', logger));
  }
}
