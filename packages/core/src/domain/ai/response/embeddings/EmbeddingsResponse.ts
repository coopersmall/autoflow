import zod from 'zod';

export type EmbeddingsResponse = zod.infer<typeof embeddingsResponseSchema>;

export const embeddingsResponseSchema = zod
  .strictObject({
    embeddings: zod
      .array(zod.array(zod.number()))
      .describe('The embedding vectors'),
    usage: zod
      .strictObject({
        tokens: zod.number().describe('Number of tokens used'),
      })
      .describe('Token usage information'),
  })
  .describe('Response from embedding multiple values');
