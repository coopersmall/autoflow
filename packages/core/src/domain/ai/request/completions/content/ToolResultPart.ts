import zod from 'zod';

export type RequestToolResultPart = zod.infer<
  typeof requestToolResultPartSchema
>;

const toolResultOutputSchema = zod.union([
  zod.strictObject({
    type: zod.literal('text'),
    value: zod.string(),
  }),
  zod.strictObject({
    type: zod.literal('json'),
    value: zod.string(), // JSONValue
  }),
  zod.strictObject({
    type: zod.literal('error-text'),
    value: zod.string(),
  }),
  zod.strictObject({
    type: zod.literal('error-json'),
    value: zod.string(), // JSONValue
  }),
  zod.strictObject({
    type: zod.literal('content'),
    value: zod.array(
      zod.union([
        zod.strictObject({
          type: zod.literal('text'),
          text: zod.string(),
        }),
        zod.strictObject({
          type: zod.literal('media'),
          data: zod.string(),
          mediaType: zod.string(),
        }),
      ]),
    ),
  }),
]);

export const requestToolResultPartSchema = zod
  .strictObject({
    type: zod.literal('tool-result'),
    toolCallId: zod
      .string()
      .describe('The tool call identifier this result corresponds to.'),
    toolName: zod.string().describe('The name of the tool.'),
    output: toolResultOutputSchema.describe('The result returned by the tool.'),
    isError: zod
      .boolean()
      .optional()
      .describe('Whether the result is an error.'),
  })
  .describe('Tool result content part in a tool message.');
