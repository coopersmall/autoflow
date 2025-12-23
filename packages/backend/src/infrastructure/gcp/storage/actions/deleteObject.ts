import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import { gcsObjectNotFound } from '../../errors/gcpErrors';
import type { DeleteRequest } from '../domain/StorageTypes';
import { getErrorCode, mapStorageError } from './storageInterfaces';

/**
 * Deletes an object from GCS.
 *
 * @param request - Delete request with bucket and object name
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with void or error
 *
 * @example
 * ```typescript
 * const result = await deleteObject(
 *   { bucketName: 'my-bucket', objectName: 'path/to/file.txt' },
 *   storage,
 *   logger,
 * );
 * ```
 */
export async function deleteObject(
  request: DeleteRequest,
  storage: Storage,
  logger: ILogger,
): Promise<Result<void, AppError>> {
  const { bucketName, objectName } = request;

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    await file.delete();

    return ok(undefined);
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

    return err(mapStorageError(e, bucketName, objectName, 'delete', logger));
  }
}
