import zod from 'zod';

export type AnthropicProviderOptions = zod.infer<
  typeof anthropicProviderOptionsSchema
>;

export const anthropicProviderOptionsSchema = zod
  .strictObject({
    disableParallelToolUse: zod
      .boolean()
      .optional()
      .describe(
        'Disables the use of parallel tool calls. Defaults to false. When set to true, the model will only call one tool at a time instead of potentially calling multiple tools in parallel.',
      ),
    sendReasoning: zod
      .boolean()
      .optional()
      .describe(
        'Include reasoning content in requests sent to the model. Defaults to true. If you are experiencing issues with the model handling requests involving reasoning content, you can set this to false to omit them from the request.',
      ),
    thinking: zod
      .strictObject({
        type: zod.literal('enabled'),
        budgetTokens: zod
          .number()
          .int()
          .positive()
          .describe('The thinking budget in tokens.'),
      })
      .optional()
      .describe(
        "Configuration for the model's thinking process. Only supported by specific Anthropic models.",
      ),
    effort: zod
      .enum(['high', 'medium', 'low'])
      .optional()
      .describe(
        'Affects thinking, text responses, and function calls. Effort defaults to high and you can set it to medium or low to save tokens and to lower time-to-last-token latency (TTLT).',
      ),
    toolStreaming: zod
      .boolean()
      .optional()
      .describe(
        'Whether to enable tool streaming (and structured output streaming). Defaults to true.',
      ),
    structuredOutputMode: zod
      .enum(['outputFormat', 'jsonTool', 'auto'])
      .optional()
      .describe(
        'Determines how structured outputs are generated. "outputFormat": Use the output_format parameter. "jsonTool": Use a special "json" tool (default). "auto": Use outputFormat when supported, otherwise fall back to jsonTool.',
      ),
    cacheControl: zod
      .strictObject({
        type: zod.literal('ephemeral'),
        ttl: zod
          .enum(['5m', '1h'])
          .optional()
          .describe('Time to live for the cache. 5m or 1h.'),
      })
      .optional()
      .describe('Cache control settings for prompt caching.'),
    container: zod
      .strictObject({
        skills: zod
          .array(
            zod.union([
              zod.strictObject({
                type: zod.literal('anthropic'),
                skillId: zod
                  .enum(['pptx', 'docx', 'pdf', 'xlsx'])
                  .describe('Built-in skill ID.'),
                version: zod.string().optional().describe('Skill version.'),
              }),
              zod.strictObject({
                type: zod.literal('custom'),
                skillId: zod.string().describe('Custom skill ID.'),
                version: zod.string().optional().describe('Skill version.'),
              }),
            ]),
          )
          .describe('Skills to enable in the container.'),
      })
      .optional()
      .describe(
        'Agent Skills enable Claude to perform specialized tasks like document processing (PPTX, DOCX, PDF, XLSX) and data analysis.',
      ),
  })
  .describe('Configuration options for the Anthropic provider');
