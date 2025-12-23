/**
 * Storage service interface for file upload/download operations.
 *
 * This service provides a provider-agnostic interface for storage operations,
 * supporting both client-side uploads (via signed URLs) and application-level
 * uploads with size-based routing.
 */

import type { Context } from '@backend/infrastructure/context';
import type { FileAsset, FileReferenceReady } from '@core/domain/file';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type {
  DeleteFileRequest,
  GetDownloadUrlRequest,
  GetFileRequest,
  GetUploadUrlRequest,
  ListFilesRequest,
  ListFilesResponse,
  UploadRequest,
  UploadStreamRequest,
  UploadUrlResponse,
} from './StorageTypes';

/**
 * Storage service interface.
 */
export type IStorageService = Readonly<{
  // ─────────────────────────────────────────────────────────────────────────
  // Client-Side Upload (External Clients)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Generate a signed URL for client-side upload.
   * Creates a FileAsset in 'uploading' state (tracked in cache).
   * The service generates the FileAssetId.
   *
   * @returns UploadUrlResponse with fileAsset, uploadUrl, and expiresAt
   */
  getUploadUrl(
    ctx: Context,
    request: GetUploadUrlRequest,
  ): Promise<Result<UploadUrlResponse, AppError>>;

  // ─────────────────────────────────────────────────────────────────────────
  // Server-Side Upload (Application Code)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Upload a small file from a buffer.
   * ENFORCES size limit (default 5MB). Rejects larger files.
   * Internally converts buffer to stream and calls uploadStream().
   */
  upload(
    ctx: Context,
    request: UploadRequest,
  ): Promise<Result<FileAsset, AppError>>;

  /**
   * Upload a file from a stream.
   * No size limit. Handles files of any size with bounded memory.
   * Uses GCS resumable uploads with progress tracking.
   */
  uploadStream(
    ctx: Context,
    request: UploadStreamRequest,
  ): Promise<Result<FileAsset, AppError>>;

  // ─────────────────────────────────────────────────────────────────────────
  // Query Operations
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get the current state of a file.
   * Derives state from: storage (ready) -> cache (uploading/failed) -> not found
   */
  getFile(
    ctx: Context,
    request: GetFileRequest,
  ): Promise<Result<FileAsset, AppError>>;

  /**
   * Generate a signed download URL.
   * File must be in 'ready' state (exists in storage).
   *
   * @returns FileReferenceReady with signed URL
   */
  getDownloadUrl(
    ctx: Context,
    request: GetDownloadUrlRequest,
  ): Promise<Result<FileReferenceReady, AppError>>;

  /**
   * List files in a folder.
   * Returns FileAsset[] constructed from storage metadata.
   */
  listFiles(
    ctx: Context,
    request: ListFilesRequest,
  ): Promise<Result<ListFilesResponse, AppError>>;

  /**
   * Delete a file from storage and cache.
   */
  deleteFile(
    ctx: Context,
    request: DeleteFileRequest,
  ): Promise<Result<void, AppError>>;
}>;
