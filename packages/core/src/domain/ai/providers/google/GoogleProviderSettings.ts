import zod from 'zod';

export type GoogleProviderSettings = zod.infer<
  typeof googleProviderSettingsSchema
>;

export const googleProviderSettingsSchema = zod
  .strictObject({
    apiKey: zod
      .string()
      .describe(
        'API key that is being sent using the x-goog-api-key header. It defaults to the GOOGLE_GENERATIVE_AI_API_KEY environment variable.',
      )
      .optional(),
  })
  .describe('Settings for the Google Generative AI provider.');
