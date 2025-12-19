import zod from 'zod';

export type ResponseMetadata = zod.infer<typeof responseMetadataSchema>;

export const responseMetadataSchema = zod
  .strictObject({
    id: zod.string().describe('The response identifier.'),
    modelId: zod.string().describe('The model that generated the response.'),
    timestamp: zod
      .string()
      .datetime()
      .describe('ISO 8601 timestamp of the response.'),
    headers: zod.record(zod.string()).optional().describe('Response headers.'),
  })
  .describe('Metadata about the response.');
