import zod from 'zod';

export type EmbeddingsRequest = zod.infer<typeof embeddingsRequestSchema>;

export const embeddingsRequestSchema = zod
  .strictObject({
    values: zod.array(zod.string()).describe('The texts to embed'),
  })
  .describe('Request to generate embeddings for one or more text values.');
