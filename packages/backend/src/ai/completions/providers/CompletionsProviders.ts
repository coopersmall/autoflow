import {
  anthropicProviderSchema,
  googleProviderSchema,
  openAIProviderSchema,
} from '@core/domain/ai/providers/AIProviders';
import zod from 'zod';
import { anthropicBuiltinToolsSchema } from './anthropic/AnthropicBuiltinTools';
import { anthropicProviderOptionsSchema } from './anthropic/AnthropicProviderOptions';
import { googleBuiltinToolsSchema } from './google/GoogleBuiltinTools';
import { googleProviderOptionsSchema } from './google/GoogleProviderOptions';
import { openAIBuiltinToolsSchema } from './openai/OpenAIBuiltinTools';
import { openAIProviderOptionsSchema } from './openai/OpenAIProviderOptions';

export type OpenAICompletionsProvider = Readonly<
  zod.infer<typeof openAICompletionsProviderSchema>
>;
export type AnthropicCompletionsProvider = Readonly<
  zod.infer<typeof anthropicCompletionsProviderSchema>
>;
export type GoogleCompletionsProvider = Readonly<
  zod.infer<typeof googleCompletionsProviderSchema>
>;
export type CompletionsProvider = Readonly<
  zod.infer<typeof completionsProviderSchema>
>;

const openAICompletionsProviderSchema = openAIProviderSchema.extend({
  options: openAIProviderOptionsSchema.optional(),
  builtinTools: openAIBuiltinToolsSchema.optional(),
});

const anthropicCompletionsProviderSchema = anthropicProviderSchema.extend({
  options: anthropicProviderOptionsSchema.optional(),
  builtinTools: anthropicBuiltinToolsSchema.optional(),
});

const googleCompletionsProviderSchema = googleProviderSchema.extend({
  options: googleProviderOptionsSchema.optional(),
  builtinTools: googleBuiltinToolsSchema.optional(),
});

export const completionsProviderSchema = zod.discriminatedUnion('provider', [
  openAICompletionsProviderSchema,
  anthropicCompletionsProviderSchema,
  googleCompletionsProviderSchema,
]);
