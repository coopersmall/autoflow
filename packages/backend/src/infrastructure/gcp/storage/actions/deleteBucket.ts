import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import { mapStorageError } from './storageInterfaces';

/**
 * Deletes a bucket from GCS.
 * Requires elevated permissions (storage.buckets.delete).
 * Bucket must be empty before deletion.
 *
 * @param bucketName - Name of the bucket to delete
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with void or error
 *
 * @example
 * ```typescript
 * const result = await deleteBucket('my-bucket', storage, logger);
 * ```
 */
export async function deleteBucket(
  bucketName: string,
  storage: Storage,
  logger: ILogger,
): Promise<Result<void, AppError>> {
  try {
    const bucket = storage.bucket(bucketName);

    await bucket.delete();

    return ok(undefined);
  } catch (e) {
    return err(
      mapStorageError(e, bucketName, undefined, 'deleteBucket', logger),
    );
  }
}
