import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import type { CreateBucketRequest } from '../domain/StorageTypes';
import { mapStorageError } from './storageInterfaces';

/**
 * Creates a new bucket in GCS.
 * Requires elevated permissions (storage.buckets.create).
 *
 * @param request - Create bucket request with name and optional settings
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with void or error
 *
 * @example
 * ```typescript
 * const result = await createBucket(
 *   { bucketName: 'my-new-bucket', location: 'US', storageClass: 'STANDARD' },
 *   storage,
 *   logger,
 * );
 * ```
 */
export async function createBucket(
  request: CreateBucketRequest,
  storage: Storage,
  logger: ILogger,
): Promise<Result<void, AppError>> {
  const { bucketName, location, storageClass } = request;

  try {
    const bucket = storage.bucket(bucketName);

    await bucket.create({
      location,
      storageClass,
    });

    return ok(undefined);
  } catch (e) {
    return err(
      mapStorageError(e, bucketName, undefined, 'createBucket', logger),
    );
  }
}
