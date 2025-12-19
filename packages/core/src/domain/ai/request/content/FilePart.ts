import zod from 'zod';

export type RequestFilePart = zod.infer<typeof requestFilePartSchema>;

export const requestFilePartSchema = zod
  .strictObject({
    type: zod.literal('file'),
    data: zod
      .string()
      .describe(
        'The file content. Base64 encoded string, base64 data URL, or http(s) URL.',
      ),
    mediaType: zod.string().describe('IANA media type of the file.'),
    filename: zod.string().optional().describe('Optional filename.'),
  })
  .describe('File content part in a message.');
