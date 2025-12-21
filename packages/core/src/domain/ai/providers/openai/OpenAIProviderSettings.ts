import zod from 'zod';

export type OpenAIProviderSettings = zod.infer<
  typeof openAIProviderSettingsSchema
>;

export const openAIProviderSettingsSchema = zod
  .strictObject({
    requestType: zod
      .enum(['responses', 'chatCompletions'])
      .default('chatCompletions')
      .describe('The type of the API to call.'),
    apiKey: zod
      .string()
      .describe(
        'API key that is being sent using the Authorization header. It defaults to the OPENAI_API_KEY environment variable.',
      )
      .optional(),
    organization: zod.string().describe('OpenAI Organization.').optional(),
    project: zod.string().describe('OpenAI project.').optional(),
  })
  .describe('Settings for the OpenAI provider.');
