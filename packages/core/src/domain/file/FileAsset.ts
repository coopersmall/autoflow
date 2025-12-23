import zod from 'zod';
import { fileAssetIdSchema } from './FileAssetId';

export type FileAsset = zod.infer<typeof fileAssetSchema>;

export const fileAssetSchema = zod
  .strictObject({
    id: fileAssetIdSchema.describe('unique identifier for the file asset'),
    state: zod
      .enum(['uploading', 'ready', 'failed'])
      .describe('current state of the file asset'),
    mediaType: zod
      .string()
      .describe('IANA media type of the file (e.g., image/png)'),
    size: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('file size in bytes'),
    url: zod
      .string()
      .url()
      .optional()
      .describe('URL where the file is stored (present when ready)'),
    checksum: zod
      .string()
      .optional()
      .describe('checksum for file integrity verification'),
    error: zod
      .string()
      .optional()
      .describe('error message (present when failed)'),
    createdAt: zod.coerce
      .date()
      .describe('when the file asset was created (ISO 8601)'),
    expiresAt: zod
      .string()
      .datetime()
      .optional()
      .describe('when the file asset expires (ISO 8601, optional)'),
  })
  .describe('A file asset stored in cloud storage');
