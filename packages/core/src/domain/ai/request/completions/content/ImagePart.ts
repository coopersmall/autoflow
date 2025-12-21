import zod from 'zod';

export type RequestImagePart = zod.infer<typeof requestImagePartSchema>;

export const requestImagePartSchema = zod
  .strictObject({
    type: zod.literal('image'),
    image: zod
      .string()
      .describe(
        'The image content. Base64 encoded string, base64 data URL, or http(s) URL.',
      ),
    mediaType: zod
      .string()
      .optional()
      .describe('IANA media type of the image (e.g., image/png, image/jpeg).'),
  })
  .describe('Image content part in a message.');
