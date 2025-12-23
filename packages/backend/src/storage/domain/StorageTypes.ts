/**
 * Request/response types for the StorageService.
 */
import type {
  FileAsset,
  FilePayload,
  FileStreamPayload,
} from '@core/domain/file';
import zod from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Defaults
// ─────────────────────────────────────────────────────────────────────────────

/** Signed URL expiration: 1 hour */
export const DEFAULT_SIGNED_URL_EXPIRATION_SECONDS = 3600;

/** Upload state TTL: 3 days */
export const DEFAULT_UPLOAD_STATE_TTL_SECONDS = 259200;

/** Small file threshold: 5MB (files <= this upload synchronously) */
export const DEFAULT_SMALL_FILE_SIZE_THRESHOLD = 5 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// Client-Side Upload Types
// ─────────────────────────────────────────────────────────────────────────────

export const getUploadUrlRequestSchema = zod.strictObject({
  folder: zod
    .string()
    .min(1)
    .describe('Folder path, e.g., "users/{userId}/files"'),
  filename: zod.string().min(1).describe('Original filename'),
  mediaType: zod.string().min(1).describe('IANA media type (e.g., image/png)'),
  size: zod.number().int().positive().describe('File size in bytes'),
});

export type GetUploadUrlRequest = Readonly<
  zod.infer<typeof getUploadUrlRequestSchema>
>;

export interface UploadUrlResponse {
  readonly fileAsset: FileAsset;
  readonly uploadUrl: string;
  readonly expiresAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Types
// ─────────────────────────────────────────────────────────────────────────────

export interface UploadRequest {
  readonly payload: FilePayload;
  readonly folder: string;
}

export interface UploadStreamRequest {
  readonly payload: FileStreamPayload;
  readonly folder: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Types
// ─────────────────────────────────────────────────────────────────────────────

export const getFileRequestSchema = zod.strictObject({
  fileId: zod.string().min(1),
  folder: zod.string().min(1),
  filename: zod.string().min(1),
});

export type GetFileRequest = Readonly<zod.infer<typeof getFileRequestSchema>>;

export const getDownloadUrlRequestSchema = zod.strictObject({
  fileId: zod.string().min(1),
  folder: zod.string().min(1),
  filename: zod.string().min(1),
  expiresInSeconds: zod.number().int().positive().optional(),
});

export type GetDownloadUrlRequest = Readonly<
  zod.infer<typeof getDownloadUrlRequestSchema>
>;

export const listFilesRequestSchema = zod.strictObject({
  folder: zod.string().min(1),
  maxResults: zod.number().int().positive().optional(),
  pageToken: zod.string().optional(),
});

export type ListFilesRequest = Readonly<
  zod.infer<typeof listFilesRequestSchema>
>;

export interface ListFilesResponse {
  readonly files: FileAsset[];
  readonly nextPageToken?: string;
}

export const deleteFileRequestSchema = zod.strictObject({
  fileId: zod.string().min(1),
  folder: zod.string().min(1),
  filename: zod.string().min(1),
});

export type DeleteFileRequest = Readonly<
  zod.infer<typeof deleteFileRequestSchema>
>;
