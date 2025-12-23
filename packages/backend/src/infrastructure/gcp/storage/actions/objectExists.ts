import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import type { ExistsRequest } from '../domain/StorageTypes';
import { mapStorageError } from './storageInterfaces';

/**
 * Checks if an object exists in GCS.
 *
 * @param request - Exists request with bucket and object name
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with boolean or error
 *
 * @example
 * ```typescript
 * const result = await objectExists(
 *   { bucketName: 'my-bucket', objectName: 'path/to/file.txt' },
 *   storage,
 *   logger,
 * );
 *
 * if (result.isOk() && result.value) {
 *   console.log('File exists!');
 * }
 * ```
 */
export async function objectExists(
  request: ExistsRequest,
  storage: Storage,
  logger: ILogger,
): Promise<Result<boolean, AppError>> {
  const { bucketName, objectName } = request;

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();

    return ok(exists);
  } catch (e) {
    return err(mapStorageError(e, bucketName, objectName, 'exists', logger));
  }
}
