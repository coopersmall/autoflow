import zod from 'zod';

export type OpenAIEmbeddingsProviderOptions = zod.infer<
  typeof openAIEmbeddingsProviderOptionsSchema
>;

export const openAIEmbeddingsProviderOptionsSchema = zod
  .strictObject({
    dimensions: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'The number of dimensions the resulting output embeddings should have. Only supported in text-embedding-3 and later models.',
      ),
    user: zod
      .string()
      .optional()
      .describe(
        'A unique identifier representing your end-user, which can help OpenAI to monitor and detect abuse.',
      ),
  })
  .describe('Configuration options for OpenAI embedding models');
