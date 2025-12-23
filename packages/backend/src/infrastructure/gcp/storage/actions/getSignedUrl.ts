import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import type { SignedUrlAction, SignedUrlRequest } from '../domain/StorageTypes';
import { mapStorageError } from './storageInterfaces';

const DEFAULT_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Generates a signed URL for temporary access to an object.
 *
 * @param request - Signed URL request with bucket, object, action, and expiry
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @returns Result with signed URL string or error
 *
 * @example
 * ```typescript
 * const result = await getSignedUrl(
 *   {
 *     bucketName: 'my-bucket',
 *     objectName: 'path/to/file.txt',
 *     action: 'read',
 *     expiresInSeconds: 3600,
 *   },
 *   storage,
 *   logger,
 * );
 *
 * if (result.isOk()) {
 *   console.log('Signed URL:', result.value);
 * }
 * ```
 */
export async function getSignedUrl(
  request: SignedUrlRequest,
  storage: Storage,
  logger: ILogger,
): Promise<Result<string, AppError>> {
  const { bucketName, objectName, action, expiresInSeconds } = request;

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: mapAction(action),
      expires: Date.now() + (expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS) * 1000,
    });

    return ok(url);
  } catch (e) {
    return err(mapStorageError(e, bucketName, objectName, 'signedUrl', logger));
  }
}

// ============================================================================
// Helpers
// ============================================================================

function mapAction(action: SignedUrlAction): 'read' | 'write' | 'delete' {
  return action;
}
