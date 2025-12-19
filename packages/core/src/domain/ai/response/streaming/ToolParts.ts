import zod from 'zod';

export type ToolCallStreamingStartPart = zod.infer<
  typeof toolCallStreamingStartPartSchema
>;
export type ToolCallDeltaPart = zod.infer<typeof toolCallDeltaPartSchema>;
export type ToolCallPart = zod.infer<typeof toolCallPartSchema>;
export type ToolResultPart = zod.infer<typeof toolResultPartSchema>;

export const toolCallStreamingStartPartSchema = zod.strictObject({
  type: zod.literal('tool-call-streaming-start'),
  toolCallId: zod.string().describe('The tool call identifier.'),
  toolName: zod.string().describe('The name of the tool.'),
});

export const toolCallDeltaPartSchema = zod.strictObject({
  type: zod.literal('tool-call-delta'),
  toolCallId: zod.string().describe('The tool call identifier.'),
  toolName: zod.string().describe('The name of the tool.'),
  argsTextDelta: zod.string().describe('The incremental arguments text.'),
});

export const toolCallPartSchema = zod.strictObject({
  type: zod.literal('tool-call'),
  toolCallId: zod.string().describe('The tool call identifier.'),
  toolName: zod.string().describe('The name of the tool.'),
  input: zod.unknown().describe('The tool arguments.'),
});

export const toolResultPartSchema = zod.strictObject({
  type: zod.literal('tool-result'),
  toolCallId: zod.string().describe('The tool call identifier.'),
  toolName: zod.string().describe('The name of the tool.'),
  input: zod.unknown().describe('The input passed to the tool.'),
  output: zod.unknown().describe('The tool result.'),
});
