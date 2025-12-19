import zod from 'zod';

export type GoogleProviderOptions = zod.infer<
  typeof googleProviderOptionsSchema
>;

const safetyCategorySchema = zod.enum([
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
]);

const safetyThresholdSchema = zod.enum([
  'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  'BLOCK_LOW_AND_ABOVE',
  'BLOCK_MEDIUM_AND_ABOVE',
  'BLOCK_ONLY_HIGH',
  'BLOCK_NONE',
]);

export const googleProviderOptionsSchema = zod
  .strictObject({
    cachedContent: zod
      .string()
      .optional()
      .describe(
        'The name of the cached content used as context to serve the prediction. Format: cachedContents/{cachedContent}',
      ),
    structuredOutputs: zod
      .boolean()
      .optional()
      .describe(
        'Enable structured output. Default is true. This is useful when the JSON Schema contains elements that are not supported by the OpenAPI schema version that Google Generative AI uses.',
      ),
    safetySettings: zod
      .array(
        zod.strictObject({
          category: safetyCategorySchema.describe(
            'The category of the safety setting.',
          ),
          threshold: safetyThresholdSchema.describe(
            'The threshold of the safety setting.',
          ),
        }),
      )
      .optional()
      .describe('Safety settings for the model.'),
    responseModalities: zod
      .array(zod.enum(['TEXT', 'IMAGE']))
      .optional()
      .describe(
        'The modalities to use for the response. When not defined or empty, the model defaults to returning only text.',
      ),
    thinkingConfig: zod
      .strictObject({
        thinkingLevel: zod
          .enum(['low', 'high'])
          .optional()
          .describe(
            "Controls the thinking depth for Gemini 3 models. Use 'low' for faster responses or 'high' for deeper reasoning. Only supported by Gemini 3 models.",
          ),
        thinkingBudget: zod
          .number()
          .int()
          .nonnegative()
          .optional()
          .describe(
            'Gives the model guidance on the number of thinking tokens it can use. Setting it to 0 disables thinking. This option is for Gemini 2.5 models. Gemini 3 models should use thinkingLevel instead.',
          ),
        includeThoughts: zod
          .boolean()
          .optional()
          .describe(
            "If set to true, thought summaries are returned, which are synthesized versions of the model's raw thoughts.",
          ),
      })
      .optional()
      .describe(
        "Configuration for the model's thinking process. Only supported by specific Google Generative AI models.",
      ),
    imageConfig: zod
      .strictObject({
        aspectRatio: zod
          .enum([
            '1:1',
            '2:3',
            '3:2',
            '3:4',
            '4:3',
            '4:5',
            '5:4',
            '9:16',
            '16:9',
            '21:9',
          ])
          .describe(
            'Aspect ratio for image generation. Model defaults to 1:1 squares.',
          ),
      })
      .optional()
      .describe(
        "Configuration for the model's image generation. Only supported by specific Google Generative AI models.",
      ),
    retrievalConfig: zod
      .strictObject({
        latLng: zod.strictObject({
          latitude: zod.number().describe('Latitude coordinate.'),
          longitude: zod.number().describe('Longitude coordinate.'),
        }),
      })
      .optional()
      .describe(
        'Provides location context for queries about nearby places. This configuration applies to any grounding tools that support location context, including Google Maps and Google Search.',
      ),
  })
  .describe('Configuration options for the Google Generative AI provider');
