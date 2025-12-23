import type { Readable } from 'node:stream';
import type { ILogger } from '@backend/infrastructure/logger/Logger';

import type { AppError } from '@core/errors/AppError';
import { Storage } from '@google-cloud/storage';

import {
  gcsAccessDenied,
  gcsBadRequest,
  gcsGatewayTimeout,
  gcsObjectNotFound,
  gcsOperationFailed,
  gcsQuotaExceeded,
  gcsServiceUnavailable,
  gcsTimeout,
  gcsUnauthorized,
} from '../../errors/gcpErrors';

// ============================================================================
// Storage Instance Interface
// ============================================================================

export interface IStorageInstance {
  bucket(name: string): IBucketHandle;
}

export interface IBucketHandle {
  file(name: string): IFileHandle;
  exists(): Promise<[boolean]>;
  create(options?: ICreateBucketOptions): Promise<unknown>;
  getFiles(
    options?: IGetFilesOptions,
  ): Promise<[IFileHandle[], unknown, unknown]>;
}

export interface IFileHandle {
  // Upload operations
  save(
    data: Buffer,
    options?: { contentType?: string; metadata?: Record<string, string> },
  ): Promise<void>;
  createWriteStream(options?: {
    contentType?: string;
    metadata?: Record<string, string>;
  }): NodeJS.WritableStream;

  // Download operations
  download(): Promise<[Buffer]>;
  createReadStream(): Readable;

  // Metadata operations
  getMetadata(): Promise<[IFileMetadata, unknown]>;
  exists(): Promise<[boolean]>;

  // Delete operations
  delete(): Promise<unknown>;

  // Signed URL operations
  getSignedUrl(options: ISignedUrlOptions): Promise<[string]>;

  // Properties
  name: string;
}

// ============================================================================
// Metadata Types
// ============================================================================

export interface IFileMetadata {
  size?: number | string;
  contentType?: string;
  etag?: string;
  generation?: number | string;
  updated?: string | Date;
}

export interface ICreateBucketOptions {
  location?: string;
  storageClass?: string;
}

export interface IGetFilesOptions {
  prefix?: string;
  maxResults?: number;
  pageToken?: string;
  autoPaginate?: boolean;
}

export interface ISignedUrlOptions {
  version: 'v4';
  action: 'read' | 'write' | 'delete';
  expires: number;
}

// ============================================================================
// Error Mapping
// ============================================================================

export function mapStorageError(
  error: unknown,
  bucket: string,
  objectName: string | undefined,
  operation:
    | 'upload'
    | 'download'
    | 'delete'
    | 'list'
    | 'exists'
    | 'getMetadata'
    | 'signedUrl'
    | 'bucketExists'
    | 'createBucket'
    | 'deleteBucket',
  logger: ILogger,
): AppError {
  const httpCode = getErrorCode(error);
  const errorMessage = error instanceof Error ? error.message : String(error);

  logger.error(`GCS ${operation} failed`, error, {
    bucket,
    objectName,
    httpCode,
  });

  const errorOptions = {
    cause: error,
    bucket,
    objectName,
    operation,
  };

  // Map HTTP status codes to AppError codes
  if (httpCode === 400) {
    return gcsBadRequest(`Bad request: ${errorMessage}`, errorOptions);
  }

  if (httpCode === 401) {
    return gcsUnauthorized(`Unauthorized: ${errorMessage}`, errorOptions);
  }

  if (httpCode === 403) {
    return gcsAccessDenied(`Access denied: ${errorMessage}`, errorOptions);
  }

  if (httpCode === 404) {
    return gcsObjectNotFound(`Object not found: ${errorMessage}`, errorOptions);
  }

  if (httpCode === 408) {
    return gcsTimeout(`Request timeout: ${errorMessage}`, errorOptions);
  }

  if (httpCode === 429) {
    return gcsQuotaExceeded(
      `Rate limit exceeded: ${errorMessage}`,
      errorOptions,
    );
  }

  if (httpCode === 500 || httpCode === 502 || httpCode === 503) {
    return gcsServiceUnavailable(
      `Service unavailable: ${errorMessage}`,
      errorOptions,
    );
  }

  if (httpCode === 504) {
    return gcsGatewayTimeout(`Gateway timeout: ${errorMessage}`, errorOptions);
  }

  // Default to generic operation failed for unknown HTTP codes
  return gcsOperationFailed(
    `${operation} failed: ${errorMessage}`,
    errorOptions,
  );
}

export function getErrorCode(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'number'
  ) {
    return error.code;
  }
  return undefined;
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Creates a GCS Storage instance.
 * The Storage class from @google-cloud/storage implements IStorageInstance.
 */
export function createStorageInstance(projectId: string): Storage {
  return new Storage({ projectId });
}
