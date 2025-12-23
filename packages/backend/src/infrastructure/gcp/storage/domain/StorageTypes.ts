import type { Readable } from 'node:stream';
import zod from 'zod';

// ============================================================================
// Request Schemas
// ============================================================================

export const storageRequestBaseSchema = zod.strictObject({
  bucketName: zod.string().min(1).describe('GCS bucket name'),
});

export const uploadRequestSchema = storageRequestBaseSchema.extend({
  objectName: zod.string().min(1).describe('Object name (path) in the bucket'),
  data: zod.instanceof(Buffer).describe('File data as Buffer'),
  contentType: zod.string().optional().describe('MIME type of the file'),
  metadata: zod.record(zod.string()).optional().describe('Custom metadata'),
});

export const downloadRequestSchema = storageRequestBaseSchema.extend({
  objectName: zod.string().min(1).describe('Object name (path) in the bucket'),
});

export const deleteRequestSchema = storageRequestBaseSchema.extend({
  objectName: zod.string().min(1).describe('Object name (path) in the bucket'),
});

export const existsRequestSchema = storageRequestBaseSchema.extend({
  objectName: zod.string().min(1).describe('Object name (path) in the bucket'),
});

export const getMetadataRequestSchema = storageRequestBaseSchema.extend({
  objectName: zod.string().min(1).describe('Object name (path) in the bucket'),
});

export const listRequestSchema = storageRequestBaseSchema.extend({
  prefix: zod.string().optional().describe('Filter objects by prefix'),
  maxResults: zod
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of results'),
  pageToken: zod.string().optional().describe('Pagination token'),
});

export const signedUrlActionSchema = zod.enum(['read', 'write', 'delete']);

export const signedUrlRequestSchema = storageRequestBaseSchema.extend({
  objectName: zod.string().min(1).describe('Object name (path) in the bucket'),
  action: signedUrlActionSchema.describe('Action to allow'),
  expiresInSeconds: zod
    .number()
    .int()
    .positive()
    .optional()
    .describe('Expiration time in seconds (default: 3600)'),
});

export const createBucketRequestSchema = zod.strictObject({
  bucketName: zod.string().min(1).describe('GCS bucket name'),
  location: zod
    .string()
    .optional()
    .describe('Bucket location (e.g., US, EU, us-central1)'),
  storageClass: zod
    .enum(['STANDARD', 'NEARLINE', 'COLDLINE', 'ARCHIVE'])
    .optional()
    .describe('Storage class'),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const uploadResponseSchema = zod.strictObject({
  bucketName: zod.string().describe('Bucket name'),
  objectName: zod.string().describe('Object name'),
  size: zod.number().describe('File size in bytes'),
  contentType: zod.string().describe('MIME type'),
  etag: zod.string().optional().describe('Entity tag'),
  generation: zod.string().optional().describe('Object generation'),
});

export const storageFileInfoSchema = zod.strictObject({
  name: zod.string().describe('Object name'),
  size: zod.number().describe('File size in bytes'),
  contentType: zod.string().describe('MIME type'),
  updated: zod.date().describe('Last updated timestamp'),
  etag: zod.string().optional().describe('Entity tag'),
});

export const getMetadataResponseSchema = zod.strictObject({
  name: zod.string().describe('Object name'),
  size: zod.number().describe('File size in bytes'),
  contentType: zod.string().describe('MIME type'),
  updated: zod.date().describe('Last updated timestamp'),
  etag: zod.string().optional().describe('Entity tag'),
  metadata: zod.record(zod.string()).optional().describe('Custom metadata'),
});

export const listResponseSchema = zod.strictObject({
  files: zod.array(storageFileInfoSchema).describe('List of files'),
  nextPageToken: zod.string().optional().describe('Token for next page'),
});

// ============================================================================
// Type Exports (without Zod for stream types)
// ============================================================================

export type StorageRequestBase = Readonly<
  zod.infer<typeof storageRequestBaseSchema>
>;
export type UploadRequest = Readonly<zod.infer<typeof uploadRequestSchema>>;
export type DownloadRequest = Readonly<zod.infer<typeof downloadRequestSchema>>;
export type DeleteRequest = Readonly<zod.infer<typeof deleteRequestSchema>>;
export type ExistsRequest = Readonly<zod.infer<typeof existsRequestSchema>>;
export type GetMetadataRequest = Readonly<
  zod.infer<typeof getMetadataRequestSchema>
>;
export type ListRequest = Readonly<zod.infer<typeof listRequestSchema>>;
export type SignedUrlAction = zod.infer<typeof signedUrlActionSchema>;
export type SignedUrlRequest = Readonly<
  zod.infer<typeof signedUrlRequestSchema>
>;
export type CreateBucketRequest = Readonly<
  zod.infer<typeof createBucketRequestSchema>
>;
export type UploadResponse = Readonly<zod.infer<typeof uploadResponseSchema>>;
export type StorageFileInfo = Readonly<zod.infer<typeof storageFileInfoSchema>>;
export type GetMetadataResponse = Readonly<
  zod.infer<typeof getMetadataResponseSchema>
>;
export type ListResponse = Readonly<zod.infer<typeof listResponseSchema>>;

/**
 * Upload request using a Readable stream for large files.
 * Not validated with Zod since Readable is not serializable.
 */
export interface UploadStreamRequest {
  readonly bucketName: string;
  readonly objectName: string;
  readonly stream: Readable;
  readonly contentType?: string;
  readonly metadata?: Record<string, string>;
}

/**
 * Download request for stream-based downloads.
 * Same as DownloadRequest but used for clarity when requesting a stream.
 */
export type DownloadStreamRequest = DownloadRequest;
