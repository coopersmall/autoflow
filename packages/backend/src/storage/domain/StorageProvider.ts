/**
 * Provider-agnostic storage interface.
 *
 * This interface defines storage operations without coupling to any specific
 * cloud provider. The bucket is configured at construction time, not per-call.
 *
 * Implementations adapt provider-specific clients (GCS, S3, Azure, etc.)
 * to this common interface.
 */
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

// ─────────────────────────────────────────────────────────────────────────────
// Input Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PutStreamOptions {
  readonly contentType: string;
  readonly size?: number; // Optional, helps GCS optimize
  readonly metadata?: Record<string, string>;
  readonly onProgress?: (bytesUploaded: number) => void; // Called after each chunk
}

export interface SignedUploadUrlOptions {
  readonly contentType: string;
  readonly expiresInSeconds: number;
}

export interface ListOptions {
  readonly maxResults?: number;
  readonly cursor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ObjectMetadata {
  readonly key: string;
  readonly size: number;
  readonly contentType: string;
  readonly updatedAt: Date;
  readonly metadata?: Record<string, string>;
}

export interface ListResult {
  readonly objects: ObjectMetadata[];
  readonly nextCursor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Interface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provider-agnostic storage interface.
 *
 * Bucket is configured at construction time, not passed per-call.
 * This keeps the interface simple and avoids repetition.
 */
export interface IStorageProvider {
  /**
   * Upload data via streaming (resumable upload).
   * Handles any file size with bounded memory usage.
   * Progress callback is invoked after each chunk is successfully uploaded.
   */
  putStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options: PutStreamOptions,
  ): Promise<Result<void, AppError>>;

  /**
   * Check if an object exists.
   */
  exists(key: string): Promise<Result<boolean, AppError>>;

  /**
   * Delete an object.
   * Succeeds even if object doesn't exist (idempotent).
   */
  delete(key: string): Promise<Result<void, AppError>>;

  /**
   * Get metadata for a single object.
   * Returns null if object doesn't exist (not an error).
   */
  getMetadata(key: string): Promise<Result<ObjectMetadata | null, AppError>>;

  /**
   * Generate a signed URL for uploading.
   */
  getSignedUploadUrl(
    key: string,
    options: SignedUploadUrlOptions,
  ): Promise<Result<string, AppError>>;

  /**
   * Generate a signed URL for downloading.
   */
  getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<Result<string, AppError>>;

  /**
   * List objects by prefix.
   */
  list(
    prefix: string,
    options?: ListOptions,
  ): Promise<Result<ListResult, AppError>>;
}
