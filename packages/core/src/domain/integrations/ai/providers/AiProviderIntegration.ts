import { baseIntegrationSchema } from '@core/domain/integrations/BaseIntegration';
import { secretIdSchema } from '@core/domain/secrets/Secret';
import zod from 'zod';

export type AiProviderIntegration = Readonly<
  zod.infer<typeof aiProviderIntegrationSchema>
>;
export type OpenAIProviderConfig = Readonly<
  zod.infer<typeof openAiProviderSchema>
>;
export type AnthropicProviderConfig = Readonly<
  zod.infer<typeof anthropicProviderSchema>
>;
export type GoogleProviderConfig = Readonly<
  zod.infer<typeof googleProviderSchema>
>;
export type OpenRouterProviderConfig = Readonly<
  zod.infer<typeof openRouterProviderSchema>
>;

const openAiProviderV1Schema = zod.strictObject({
  schemaVersion: zod.literal(1),
  apiKey: secretIdSchema.describe('the secret containing the OpenAI API key'),
  organizationId: zod
    .string()
    .optional()
    .describe('the OpenAI organization ID'),
});

export const openAiProviderConfigSchema = zod.discriminatedUnion(
  'schemaVersion',
  [openAiProviderV1Schema],
);

export const openAiProviderSchema = zod.strictObject({
  provider: zod.literal('openai'),
  data: openAiProviderConfigSchema,
});

const anthropicProviderV1Schema = zod.strictObject({
  schemaVersion: zod.literal(1),
  apiKey: secretIdSchema.describe(
    'the secret containing the Anthropic API key',
  ),
});

export const anthropicProviderConfigSchema = zod.discriminatedUnion(
  'schemaVersion',
  [anthropicProviderV1Schema],
);

export const anthropicProviderSchema = zod.strictObject({
  provider: zod.literal('anthropic'),
  data: anthropicProviderConfigSchema,
});

const googleProviderV1Schema = zod.strictObject({
  schemaVersion: zod.literal(1),
  apiKey: secretIdSchema.describe('the secret containing the Google API key'),
});

export const googleProviderConfigSchema = zod.discriminatedUnion(
  'schemaVersion',
  [googleProviderV1Schema],
);

export const googleProviderSchema = zod.strictObject({
  provider: zod.literal('google'),
  data: googleProviderConfigSchema,
});

const openRouterProviderV1Schema = zod.strictObject({
  schemaVersion: zod.literal(1),
  apiKey: secretIdSchema.describe(
    'the secret containing the OpenRouter API key',
  ),
});

export const openRouterProviderConfigSchema = zod.discriminatedUnion(
  'schemaVersion',
  [openRouterProviderV1Schema],
);

export const openRouterProviderSchema = zod.strictObject({
  provider: zod.literal('openrouter'),
  data: openRouterProviderConfigSchema,
});

export const aiProviderConfigSchema = zod.discriminatedUnion('provider', [
  openAiProviderSchema,
  anthropicProviderSchema,
  googleProviderSchema,
  openRouterProviderSchema,
]);

export const aiProviderIntegrationSchema = baseIntegrationSchema.extend({
  type: zod.literal('ai-provider'),
  config: aiProviderConfigSchema.describe('the AI provider config'),
});

export function isAiProviderIntegration(
  config: unknown,
): config is AiProviderIntegration {
  return aiProviderIntegrationSchema.safeParse(config).success;
}

export function isOpenAIProviderIntegration(
  config: unknown,
): config is OpenAIProviderConfig {
  return openAiProviderSchema.safeParse(config).success;
}

export function isAnthropicProviderIntegration(
  config: unknown,
): config is AnthropicProviderConfig {
  return anthropicProviderSchema.safeParse(config).success;
}

export function isGoogleProviderIntegration(
  config: unknown,
): config is GoogleProviderConfig {
  return googleProviderSchema.safeParse(config).success;
}

export function isOpenRouterProviderIntegration(
  config: unknown,
): config is OpenRouterProviderConfig {
  return openRouterProviderSchema.safeParse(config).success;
}
