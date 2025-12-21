import zod from 'zod';

export type ToolResult = zod.infer<typeof toolResultSchema>;

export const toolResultSchema = zod
  .strictObject({
    toolCallId: zod.string().describe('The tool call identifier.'),
    toolName: zod.string().describe('The name of the tool.'),
    input: zod.unknown().describe('The input/arguments passed to the tool.'),
    output: zod.unknown().describe('The result returned by the tool.'),
    isError: zod
      .boolean()
      .optional()
      .describe('Whether the result is an error.'),
  })
  .describe('The result of a tool execution.');
