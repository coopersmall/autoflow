import zod from 'zod';

export const toolCallResultSchema = zod.strictObject({
  toolCallId: zod.string().describe('The tool call identifier'),
  toolName: zod.string().describe('The name of the tool'),
  input: zod.unknown().describe('The input/arguments passed to the tool'),
  output: zod.unknown().describe('The result returned by the tool'),
  isError: zod.boolean().optional().describe('Whether the result is an error'),
  timestamp: zod.coerce
    .date()
    .optional()
    .describe('The ISO timestamp when the tool call was completed'),
});

export type ToolCallResult = zod.infer<typeof toolCallResultSchema>;
