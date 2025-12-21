import zod from 'zod';

export type AnthropicProviderSettings = zod.infer<
  typeof anthropicProviderSettingsSchema
>;

export const anthropicProviderSettingsSchema = zod
  .strictObject({
    apiKey: zod
      .string()
      .describe(
        'API key that is being sent using the x-api-key header. It defaults to the ANTHROPIC_API_KEY environment variable.',
      )
      .optional(),
  })
  .describe('Settings for the Anthropic provider.');
