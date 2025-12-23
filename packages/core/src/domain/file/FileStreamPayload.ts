import type { FileAssetId } from './FileAssetId';

/**
 * File payload with a ReadableStream for streaming large files.
 *
 * Unlike FilePayload (which buffers the entire file in memory),
 * FileStreamPayload streams data in chunks, allowing bounded memory usage
 * regardless of file size.
 *
 * Used for:
 * - Large file uploads (>5MB)
 * - Streaming data sources (BigQuery exports, S3-to-GCS transfers)
 * - Any scenario where buffering the full file would cause memory pressure
 *
 * Note: Streams cannot be validated with Zod, so this is a plain interface
 * rather than a Zod schema. Basic validation is performed at runtime.
 */
export interface FileStreamPayload {
  readonly id: FileAssetId;
  readonly filename: string;
  readonly mediaType: string;
  readonly size?: number; // Optional - unknown for some streams
  readonly stream: ReadableStream<Uint8Array>;
}

/**
 * Basic runtime validation for FileStreamPayload.
 * Does not validate the stream itself (not possible), only structure.
 */
export function validFileStreamPayload(
  input: unknown,
): input is FileStreamPayload {
  if (!input || typeof input !== 'object') {
    return false;
  }

  if (
    !('id' in input) ||
    !('filename' in input) ||
    !('mediaType' in input) ||
    !('stream' in input)
  ) {
    return false;
  }

  return (
    typeof input.id === 'string' &&
    input.id.length > 0 &&
    typeof input.filename === 'string' &&
    input.filename.length > 0 &&
    typeof input.mediaType === 'string' &&
    input.mediaType.length > 0 &&
    (!('size' in input) ||
      input.size === undefined ||
      (typeof input.size === 'number' && input.size > 0)) &&
    input.stream instanceof ReadableStream
  );
}
