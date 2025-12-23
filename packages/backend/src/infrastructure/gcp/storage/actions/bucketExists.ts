import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import { mapStorageError } from './storageInterfaces';

/**
 * Checks if a bucket exists in GCS.
 *
 * @param bucketName - Name of the bucket to check
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with boolean or error
 *
 * @example
 * ```typescript
 * const result = await bucketExists('my-bucket', storage, logger);
 *
 * if (result.isOk() && result.value) {
 *   console.log('Bucket exists!');
 * }
 * ```
 */
export async function bucketExists(
  bucketName: string,
  storage: Storage,
  logger: ILogger,
): Promise<Result<boolean, AppError>> {
  try {
    const bucket = storage.bucket(bucketName);

    const [exists] = await bucket.exists();

    return ok(exists);
  } catch (e) {
    return err(
      mapStorageError(e, bucketName, undefined, 'bucketExists', logger),
    );
  }
}
