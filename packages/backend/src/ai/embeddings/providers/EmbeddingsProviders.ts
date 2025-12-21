import {
  googleProviderSchema,
  openAIProviderSchema,
} from '@core/domain/ai/providers/AIProviders';
import zod from 'zod';
import { googleEmbeddingsProviderOptionsSchema } from './google/GoogleEmbeddingsProviderOptions';
import { openAIEmbeddingsProviderOptionsSchema } from './openai/OpenAIEmbeddingsProviderOptions';

export type OpenAIEmbeddingsProvider = Readonly<
  zod.infer<typeof openAIEmbeddingsProviderSchema>
>;
export type GoogleEmbeddingsProvider = Readonly<
  zod.infer<typeof googleEmbeddingsProviderSchema>
>;
export type EmbeddingsProvider = Readonly<
  zod.infer<typeof embeddingsProviderSchema>
>;

const openAIEmbeddingsProviderSchema = openAIProviderSchema.extend({
  options: openAIEmbeddingsProviderOptionsSchema.optional(),
});

const googleEmbeddingsProviderSchema = googleProviderSchema.extend({
  options: googleEmbeddingsProviderOptionsSchema.optional(),
});

export const embeddingsProviderSchema = zod.discriminatedUnion('provider', [
  openAIEmbeddingsProviderSchema,
  googleEmbeddingsProviderSchema,
]);
