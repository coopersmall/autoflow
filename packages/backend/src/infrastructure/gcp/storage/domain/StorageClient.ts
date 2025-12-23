import type { Readable } from 'node:stream';

import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

import type {
  CreateBucketRequest,
  DeleteRequest,
  DownloadRequest,
  DownloadStreamRequest,
  ExistsRequest,
  GetMetadataRequest,
  GetMetadataResponse,
  ListRequest,
  ListResponse,
  SignedUrlRequest,
  UploadRequest,
  UploadResponse,
  UploadStreamRequest,
} from './StorageTypes';

/**
 * Storage client interface for object storage operations.
 * Implementation-agnostic - could be backed by GCS, S3, local filesystem, etc.
 */
export type IStorageClient = Readonly<{
  // ============================================================================
  // Object Operations
  // ============================================================================

  /**
   * Upload data from a Buffer.
   */
  upload(request: UploadRequest): Promise<Result<UploadResponse, AppError>>;

  /**
   * Upload data from a Readable stream (for large files).
   */
  uploadStream(
    request: UploadStreamRequest,
  ): Promise<Result<UploadResponse, AppError>>;

  /**
   * Download object contents to a Buffer.
   */
  download(request: DownloadRequest): Promise<Result<Buffer, AppError>>;

  /**
   * Download object as a Readable stream (for large files).
   */
  downloadStream(
    request: DownloadStreamRequest,
  ): Promise<Result<Readable, AppError>>;

  /**
   * Delete an object.
   */
  delete(request: DeleteRequest): Promise<Result<void, AppError>>;

  /**
   * Check if an object exists.
   */
  exists(request: ExistsRequest): Promise<Result<boolean, AppError>>;

  /**
   * Get metadata for a single object.
   * Returns null if the object does not exist.
   */
  getMetadata(
    request: GetMetadataRequest,
  ): Promise<Result<GetMetadataResponse | null, AppError>>;

  /**
   * List objects in a bucket with optional prefix filter.
   */
  list(request: ListRequest): Promise<Result<ListResponse, AppError>>;

  /**
   * Generate a signed URL for temporary access to an object.
   */
  getSignedUrl(request: SignedUrlRequest): Promise<Result<string, AppError>>;

  // ============================================================================
  // Bucket Operations
  // ============================================================================

  /**
   * Check if a bucket exists.
   */
  bucketExists(bucketName: string): Promise<Result<boolean, AppError>>;

  /**
   * Create a new bucket.
   * Requires elevated permissions (storage.buckets.create).
   */
  createBucket(request: CreateBucketRequest): Promise<Result<void, AppError>>;

  // ============================================================================
  // Properties
  // ============================================================================

  /**
   * Project ID from the auth client.
   */
  readonly projectId: string;
}>;
