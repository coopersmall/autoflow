import zod from 'zod';

export type GoogleEmbeddingsProviderOptions = zod.infer<
  typeof googleEmbeddingsProviderOptionsSchema
>;

const taskTypeSchema = zod.enum([
  'SEMANTIC_SIMILARITY',
  'CLASSIFICATION',
  'CLUSTERING',
  'RETRIEVAL_DOCUMENT',
  'RETRIEVAL_QUERY',
  'QUESTION_ANSWERING',
  'FACT_VERIFICATION',
  'CODE_RETRIEVAL_QUERY',
]);

export const googleEmbeddingsProviderOptionsSchema = zod
  .strictObject({
    outputDimensionality: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        'Optional reduced dimension for the output embedding. If set, excessive values in the output embedding are truncated from the end.',
      ),
    taskType: taskTypeSchema
      .optional()
      .describe(
        'Specifies the task type for generating embeddings. Different task types optimize embeddings for specific use cases.',
      ),
  })
  .describe('Configuration options for Google embedding models');
