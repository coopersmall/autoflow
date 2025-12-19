import zod from 'zod';

export type RequestToolResultPart = zod.infer<
  typeof requestToolResultPartSchema
>;

export const requestToolResultPartSchema = zod
  .strictObject({
    type: zod.literal('tool-result'),
    toolCallId: zod
      .string()
      .describe('The tool call identifier this result corresponds to.'),
    toolName: zod.string().describe('The name of the tool.'),
    output: zod.unknown().describe('The result returned by the tool.'),
    isError: zod
      .boolean()
      .optional()
      .describe('Whether the result is an error.'),
  })
  .describe('Tool result content part in a tool message.');
