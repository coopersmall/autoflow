import zod from 'zod';
import { fileAssetIdSchema } from './FileAssetId';

const fileReferenceReadySchema = zod.strictObject({
  status: zod.literal('ready'),
  id: fileAssetIdSchema.describe('unique identifier for the file asset'),
  url: zod.string().url().describe('URL where the file is stored'),
  mediaType: zod
    .string()
    .describe('IANA media type of the file (e.g., image/png)'),
  size: zod.number().int().positive().optional().describe('file size in bytes'),
});

const fileReferenceFailedSchema = zod.strictObject({
  status: zod.literal('failed'),
  id: fileAssetIdSchema.describe('unique identifier for the file asset'),
  mediaType: zod
    .string()
    .describe('IANA media type of the file (e.g., image/png)'),
  error: zod.string().describe('error message describing the failure'),
});

export type FileReference = zod.infer<typeof fileReferenceSchema>;
export type FileReferenceReady = zod.infer<typeof fileReferenceReadySchema>;
export type FileReferenceFailed = zod.infer<typeof fileReferenceFailedSchema>;

export const fileReferenceSchema = zod
  .discriminatedUnion('status', [
    fileReferenceReadySchema,
    fileReferenceFailedSchema,
  ])
  .describe('Reference to a file asset in completed conversation items');
