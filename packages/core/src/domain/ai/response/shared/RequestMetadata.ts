import zod from 'zod';

export type RequestMetadata = zod.infer<typeof requestMetadataSchema>;

export const requestMetadataSchema = zod
  .strictObject({
    body: zod
      .string()
      .describe('Raw request body sent to the provider (JSON stringified).'),
  })
  .describe('Metadata about the request.');
