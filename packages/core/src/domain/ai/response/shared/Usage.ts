import zod from 'zod';

export type Usage = zod.infer<typeof usageSchema>;

export const usageSchema = zod
  .strictObject({
    inputTokens: zod
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Number of input (prompt) tokens used.'),
    outputTokens: zod
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Number of output (completion) tokens used.'),
    totalTokens: zod
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe(
        'Total tokens. May include reasoning tokens or other overhead.',
      ),
    reasoningTokens: zod
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Number of reasoning tokens used.'),
    cachedInputTokens: zod
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Number of cached input tokens.'),
  })
  .describe('Token usage information.');
