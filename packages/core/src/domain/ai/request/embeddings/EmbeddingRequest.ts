import zod from 'zod';

export type EmbeddingRequest = zod.infer<typeof embeddingRequestSchema>;

export const embeddingRequestSchema = zod
  .strictObject({
    value: zod.string().describe('The text to embed'),
  })
  .describe('Request to generate an embedding for a single text value.');
