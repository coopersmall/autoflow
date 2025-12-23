import zod from 'zod';
import { fileAssetIdSchema } from './FileAssetId';

export type FilePayload = zod.infer<typeof filePayloadSchema>;

export const filePayloadSchema = zod
  .strictObject({
    id: fileAssetIdSchema.describe('unique identifier for the file asset'),
    filename: zod.string().min(1).describe('original filename'),
    mediaType: zod
      .string()
      .describe('IANA media type of the file (e.g., image/png)'),
    data: zod
      .instanceof(Uint8Array<ArrayBuffer | SharedArrayBuffer>)
      .describe('raw binary data of the file'),
    size: zod.number().int().positive().describe('file size in bytes'),
  })
  .describe('File payload containing raw data for upload (side-channel)');
