import zod from 'zod';

export type ToolCall = zod.infer<typeof toolCallSchema>;

export const toolCallSchema = zod
  .strictObject({
    toolCallId: zod.string().describe('The tool call identifier.'),
    toolName: zod.string().describe('The name of the tool.'),
    input: zod.unknown().describe('The input/arguments for the tool.'),
  })
  .describe('A tool call made by the model.');
