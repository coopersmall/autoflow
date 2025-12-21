import zod from 'zod';

export type RequestToolCallPart = zod.infer<typeof requestToolCallPartSchema>;

export const requestToolCallPartSchema = zod
  .strictObject({
    type: zod.literal('tool-call'),
    toolCallId: zod.string().describe('The tool call identifier.'),
    toolName: zod.string().describe('The name of the tool.'),
    input: zod.string().describe('The input/arguments for the tool.'),
  })
  .describe('Tool call content part in an assistant message.');
