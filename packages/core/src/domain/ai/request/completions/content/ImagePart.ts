import { fileAssetIdSchema } from '@core/domain/file/FileAssetId';
import zod from 'zod';

export type RequestImagePart = zod.infer<typeof requestImagePartSchema>;

const imageDataScheme = zod.union([
  zod.string().url(),
  zod.instanceof(Uint8Array<ArrayBufferLike>),
]);

export const requestImagePartSchema = zod
  .strictObject({
    type: zod.literal('image'),
    image: imageDataScheme.describe(
      'The image content. Base64 encoded string, base64 data URL, or http(s) URL.',
    ),
    mediaType: zod
      .string()
      .optional()
      .describe('IANA media type of the image (e.g., image/png, image/jpeg).'),
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
  .describe('Image content part in a message.');
