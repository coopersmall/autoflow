import zod from 'zod';

export const aiProviders = [
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'groq',
] as const;
export const aiProviderSchema = zod.enum(aiProviders);
export type AIProvider = (typeof aiProviders)[number];

const modelRequestBaseSchema = zod.strictObject({
  provider: zod.enum(aiProviders),
  model: zod.string().describe('the model name to use for the request'),
});

const openAIModelRequestSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('openai'),
});

const anthropicModelRequestSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('anthropic'),
});

const googleModelRequestSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('google'),
});

const openRouterModelRequestSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('openrouter'),
});

const groqModelRequestSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('groq'),
});

export const openAIModelRequestSchemas = [openAIModelRequestSchema] as const;
export const anthropicModelRequestSchemas = [
  anthropicModelRequestSchema,
] as const;
export const googleModelRequestSchemas = [googleModelRequestSchema] as const;
export const openRouterModelRequestSchemas = [
  openRouterModelRequestSchema,
] as const;
export const groqModelRequestSchemas = [groqModelRequestSchema] as const;

export const modelRequestSchema = zod.discriminatedUnion('provider', [
  ...openAIModelRequestSchemas,
  ...anthropicModelRequestSchemas,
  ...googleModelRequestSchemas,
  ...openRouterModelRequestSchemas,
  ...groqModelRequestSchemas,
]);

export type ModelRequest = zod.infer<typeof modelRequestSchema>;
export type OpenAIModelRequest = zod.infer<typeof openAIModelRequestSchema>;
export type AnthropicModelRequest = zod.infer<
  typeof anthropicModelRequestSchema
>;
export type GoogleModelRequest = zod.infer<typeof googleModelRequestSchema>;
export type OpenRouterModelRequest = zod.infer<
  typeof openRouterModelRequestSchema
>;
export type GroqModelRequest = zod.infer<typeof groqModelRequestSchema>;
