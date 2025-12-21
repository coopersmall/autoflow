import zod from 'zod';

export type OpenAIProviderOptions = zod.infer<
  typeof openAIProviderOptionsSchema
>;

export const openAIProviderOptionsSchema = zod
  .strictObject({
    parallelToolCalls: zod
      .boolean()
      .optional()
      .describe('Whether to use parallel tool calls. Defaults to true.'),
    reasoningEffort: zod
      .enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh'])
      .optional()
      .describe(
        'Reasoning effort for reasoning models. Defaults to medium. If you use providerOptions to set the reasoningEffort option, this model setting will be ignored.',
      ),
    reasoningSummary: zod
      .enum(['auto', 'detailed'])
      .optional()
      .describe(
        "Controls whether the model returns its reasoning process. Set to 'auto' for a condensed summary, 'detailed' for more comprehensive reasoning. Defaults to undefined (no reasoning summaries). When enabled, reasoning summaries appear in the stream as events with type 'reasoning' and in non-streaming responses within the reasoning field.",
      ),
    strictJsonSchema: zod
      .boolean()
      .optional()
      .describe(
        'Whether to use strict JSON schema validation. Defaults to false.',
      ),
    serviceTier: zod
      .enum(['auto', 'flex', 'priority', 'default'])
      .optional()
      .describe(
        "Service tier for the request. Set to 'flex' for 50% cheaper processing at the cost of increased latency (available for o3, o4-mini, and gpt-5 models). Set to 'priority' for faster processing with Enterprise access (available for gpt-4, gpt-5, gpt-5-mini, o3, o4-mini; gpt-5-nano is not supported). Defaults to 'auto'.",
      ),
  })
  .describe('Configuration options for the OpenAI provider');
