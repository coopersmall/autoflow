import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AppError } from '@core/errors/AppError';
import type { Storage } from '@google-cloud/storage';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';

import type {
  UploadResponse,
  UploadStreamRequest,
} from '../domain/StorageTypes';
import { mapStorageError } from './storageInterfaces';

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

/**
 * Uploads a Readable stream to GCS (for large files).
 *
 * @param request - Upload request with bucket, object name, and stream
 * @param storage - GCS Storage instance
 * @param logger - Logger instance
 * @param dependencies - Injectable dependencies for testing
 * @returns Result with upload response or error
 *
 * @example
 * ```typescript
 * const result = await uploadObjectStream(
 *   { bucketName: 'my-bucket', objectName: 'path/to/file.txt', stream: readStream },
 *   storage,
 *   logger,
 * );
 * ```
 */
export async function uploadObjectStream(
  request: UploadStreamRequest,
  storage: Storage,
  logger: ILogger,
  dependencies = { pipelineStreams },
): Promise<Result<UploadResponse, AppError>> {
  const { bucketName, objectName, stream, contentType, metadata } = request;

  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(objectName);

    const writeStream = file.createWriteStream({
      contentType: contentType ?? DEFAULT_CONTENT_TYPE,
      metadata,
    });

    await dependencies.pipelineStreams(stream, writeStream);

    const [fileMetadata] = await file.getMetadata();

    return ok({
      bucketName,
      objectName,
      size: Number(fileMetadata.size ?? 0),
      contentType: fileMetadata.contentType ?? DEFAULT_CONTENT_TYPE,
      etag: fileMetadata.etag,
      generation: fileMetadata.generation?.toString(),
    });
  } catch (e) {
    return err(mapStorageError(e, bucketName, objectName, 'upload', logger));
  }
}

// ============================================================================
// Dependencies
// ============================================================================

async function pipelineStreams(
  source: Readable,
  destination: NodeJS.WritableStream,
): Promise<void> {
  await pipeline(source, destination);
}
