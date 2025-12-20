import zod from 'zod';
import { anthropicProviderSettingsSchema } from './anthropic/AnthropicProviderSettings';
import { googleProviderSettingsSchema } from './google/GoogleProviderSettings';
import { openAIProviderSettingsSchema } from './openai/OpenAIProviderSettings';

export const aiProviderSchema = zod.enum(['openai', 'anthropic', 'google']);
export type AIProvider = zod.infer<typeof aiProviderSchema>;

const modelRequestBaseSchema = zod.strictObject({
  provider: aiProviderSchema,
  model: zod.string().describe('the model name to use for the request'),
});

export const openAIProviderSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('openai'),
  settings: openAIProviderSettingsSchema,
});

export const anthropicProviderSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('anthropic'),
  settings: anthropicProviderSettingsSchema,
});

export const googleProviderSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('google'),
  settings: googleProviderSettingsSchema,
});

export type OpenAIModelRequest = Readonly<
  zod.infer<typeof openAIProviderSchema>
>;
export type AnthropicModelRequest = Readonly<
  zod.infer<typeof anthropicProviderSchema>
>;
export type GoogleModelRequest = Readonly<
  zod.infer<typeof googleProviderSchema>
>;
