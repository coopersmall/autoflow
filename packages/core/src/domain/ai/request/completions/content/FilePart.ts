import { fileAssetIdSchema } from '@core/domain/file/FileAssetId';
import zod from 'zod';

export type RequestFilePart = zod.infer<typeof requestFilePartSchema>;

const fileDataScheme = zod.union([
  zod.string().url(),
  zod.instanceof(Uint8Array<ArrayBufferLike>),
]);

export const requestFilePartSchema = zod
  .strictObject({
    type: zod.literal('file'),
    data: fileDataScheme.describe(
      'The file content. Base64 encoded string, base64 data URL, or http(s) URL.',
    ),
    mediaType: zod.string().describe('IANA media type of the file.'),
    filename: zod.string().optional().describe('Optional filename.'),
    storageFileId: fileAssetIdSchema
      .optional()
      .describe(
        'File ID in storage - present if uploaded during state serialization',
      ),
    storageFilename: zod
      .string()
      .optional()
      .describe(
        'Filename in storage - present if uploaded during state serialization',
      ),
  })
  .describe('File content part in a message.');
