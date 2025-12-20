import zod from 'zod';

export type EmbeddingResponse = zod.infer<typeof embeddingResponseSchema>;

export const embeddingResponseSchema = zod
  .strictObject({
    embedding: zod.array(zod.number()).describe('The embedding vector'),
    usage: zod
      .strictObject({
        tokens: zod.number().describe('Number of tokens used'),
      })
      .describe('Token usage information'),
  })
  .describe('Response from embedding a single value');
