import zod from 'zod';

// Web Search Tool
export type OpenAIWebSearchToolOptions = zod.infer<
  typeof openAIWebSearchToolOptionsSchema
>;
export const openAIWebSearchToolOptionsSchema = zod
  .strictObject({
    externalWebAccess: zod
      .boolean()
      .optional()
      .describe('Whether to allow external web access.'),
    searchContextSize: zod
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('The size of the search context.'),
    userLocation: zod
      .strictObject({
        type: zod.literal('approximate'),
        city: zod.string().optional().describe('The city of the user.'),
        region: zod.string().optional().describe('The region of the user.'),
        country: zod.string().optional().describe('The country of the user.'),
        timezone: zod.string().optional().describe('The timezone of the user.'),
      })
      .optional()
      .describe('The approximate location of the user.'),
  })
  .describe('Configuration options for the OpenAI web search tool.');

// File Search Tool
export type OpenAIFileSearchToolOptions = zod.infer<
  typeof openAIFileSearchToolOptionsSchema
>;
const fileSearchFilterSchema = zod.strictObject({
  key: zod.string().describe('The metadata key to filter on.'),
  type: zod
    .enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte'])
    .describe('The comparison type.'),
  value: zod
    .union([zod.string(), zod.number(), zod.boolean()])
    .describe('The value to compare against.'),
});

const fileSearchRankingSchema = zod.strictObject({
  ranker: zod
    .enum(['auto', 'default_2024_08_21'])
    .optional()
    .describe('The ranker to use.'),
  scoreThreshold: zod
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('The minimum score threshold for results.'),
});

export const openAIFileSearchToolOptionsSchema = zod
  .strictObject({
    vectorStoreIds: zod
      .array(zod.string())
      .describe('The IDs of the vector stores to search.'),
    maxNumResults: zod
      .number()
      .int()
      .positive()
      .optional()
      .describe('The maximum number of results to return.'),
    filters: fileSearchFilterSchema
      .optional()
      .describe('Filters to apply to the search.'),
    ranking: fileSearchRankingSchema
      .optional()
      .describe('Ranking configuration for search results.'),
  })
  .describe('Configuration options for the OpenAI file search tool.');

// Image Generation Tool
export type OpenAIImageGenerationToolOptions = zod.infer<
  typeof openAIImageGenerationToolOptionsSchema
>;
export const openAIImageGenerationToolOptionsSchema = zod
  .strictObject({
    outputFormat: zod
      .enum(['png', 'webp', 'jpeg'])
      .optional()
      .describe('The output format of the generated image.'),
    quality: zod
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('The quality of the generated image.'),
    size: zod
      .enum(['1024x1024', '1536x1024', '1024x1536'])
      .optional()
      .describe('The size of the generated image.'),
    background: zod
      .enum(['transparent', 'opaque'])
      .optional()
      .describe('The background of the generated image.'),
  })
  .describe('Configuration options for the OpenAI image generation tool.');

// Code Interpreter Tool
export type OpenAICodeInterpreterToolOptions = zod.infer<
  typeof openAICodeInterpreterToolOptionsSchema
>;
export const openAICodeInterpreterToolOptionsSchema = zod
  .strictObject({
    container: zod
      .union([
        zod.string().describe('The container ID to use.'),
        zod.strictObject({
          fileIds: zod
            .array(zod.string())
            .optional()
            .describe('File IDs to make available to the code interpreter.'),
        }),
      ])
      .optional()
      .describe('Container configuration for the code interpreter.'),
  })
  .describe('Configuration options for the OpenAI code interpreter tool.');
export type OpenAILocalShellToolOptions = zod.infer<
  typeof openAILocalShellToolOptionsSchema
>;
export const openAILocalShellToolOptionsSchema = zod
  .strictObject({})
  .describe(
    'Configuration options for the OpenAI local shell tool. Note: The execute callback must be provided at runtime.',
  );

// Combined Builtin Tools Schema
export type OpenAIBuiltinTools = zod.infer<typeof openAIBuiltinToolsSchema>;
export const openAIBuiltinToolsSchema = zod
  .strictObject({
    webSearch: openAIWebSearchToolOptionsSchema.optional(),
    fileSearch: openAIFileSearchToolOptionsSchema.optional(),
    imageGeneration: openAIImageGenerationToolOptionsSchema.optional(),
    codeInterpreter: openAICodeInterpreterToolOptionsSchema.optional(),
    localShell: openAILocalShellToolOptionsSchema.optional(),
  })
  .describe('OpenAI built-in tools configuration.');
