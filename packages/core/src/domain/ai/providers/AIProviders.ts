import zod from 'zod';
import { anthropicBuiltinToolsSchema } from './anthropic/AnthropicBuiltinTools';
import { anthropicProviderOptionsSchema } from './anthropic/AnthropicProviderOptions';
import { anthropicProviderSettingsSchema } from './anthropic/AnthropicProviderSettings';
import { googleBuiltinToolsSchema } from './google/GoogleBuiltinTools';
import { googleProviderOptionsSchema } from './google/GoogleProviderOptions';
import { googleProviderSettingsSchema } from './google/GoogleProviderSettings';
import { openAIBuiltinToolsSchema } from './openai/OpenAIBuiltinTools';
import { openAIProviderOptionsSchema } from './openai/OpenAIProviderOptions';
import { openAIProviderSettingsSchema } from './openai/OpenAIProviderSettings';

export type AIProvider = (typeof aiProviders)[number];
export type OpenAIModelRequest = Readonly<
  zod.infer<typeof openAIModelRequestSchema>
>;
export type AnthropicModelRequest = Readonly<
  zod.infer<typeof anthropicModelRequestSchema>
>;
export type GoogleModelRequest = Readonly<
  zod.infer<typeof googleModelRequestSchema>
>;
export type ModelRequest = Readonly<zod.infer<typeof modelRequestSchema>>;

export const aiProviders = ['openai', 'anthropic', 'google'] as const;
export const aiProviderSchema = zod.enum(aiProviders);

const modelRequestBaseSchema = zod.strictObject({
  provider: zod.enum(aiProviders),
  model: zod.string().describe('the model name to use for the request'),
});

const openAIModelRequestSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('openai'),
  settings: openAIProviderSettingsSchema,
  options: openAIProviderOptionsSchema.optional(),
  builtinTools: openAIBuiltinToolsSchema.optional(),
});

const anthropicModelRequestSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('anthropic'),
  settings: anthropicProviderSettingsSchema,
  options: anthropicProviderOptionsSchema.optional(),
  builtinTools: anthropicBuiltinToolsSchema.optional(),
});

const googleModelRequestSchema = modelRequestBaseSchema.extend({
  provider: zod.literal('google'),
  settings: googleProviderSettingsSchema,
  options: googleProviderOptionsSchema.optional(),
  builtinTools: googleBuiltinToolsSchema.optional(),
});

export const openAIModelRequestSchemas = [openAIModelRequestSchema] as const;
export const anthropicModelRequestSchemas = [
  anthropicModelRequestSchema,
] as const;
export const googleModelRequestSchemas = [googleModelRequestSchema] as const;

export const modelRequestSchema = zod.discriminatedUnion('provider', [
  ...openAIModelRequestSchemas,
  ...anthropicModelRequestSchemas,
  ...googleModelRequestSchemas,
]);
