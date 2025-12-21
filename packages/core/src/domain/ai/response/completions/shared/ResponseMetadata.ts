import zod from 'zod';

export type ResponseMetadata = zod.infer<typeof responseMetadataSchema>;

export const responseMetadataSchema = zod
  .strictObject({
    id: zod.string().describe('ID for the generated response.'),
    timestamp: zod
      .date()
      .describe('Timestamp for the start of the generated response.'),
    modelId: zod
      .string()
      .describe(
        'The ID of the response model that was used to generate the response.',
      ),
    headers: zod
      .record(zod.string())
      .optional()
      .describe(
        'Response headers (available only for providers that use HTTP requests).',
      ),
  })
  .describe('Metadata about the response.');
