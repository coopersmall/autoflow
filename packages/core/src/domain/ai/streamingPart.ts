import zod from 'zod';

const finishReasonSchema = zod.enum([
  'stop',
  'length',
  'content-filter',
  'tool-calls',
  'error',
  'other',
  'unknown',
]);

const usageSchema = zod.strictObject({
  promptTokens: zod
    .number()
    .optional()
    .describe('number of tokens in the prompt'),
  completionTokens: zod
    .number()
    .optional()
    .describe('number of tokens in the completion'),
  totalTokens: zod.number().optional().describe('total number of tokens used'),
});

const textPartSchema = zod.strictObject({
  type: zod.literal('text'),
  content: zod.string().describe('the text content'),
});

const reasoningPartSchema = zod.strictObject({
  type: zod.literal('reasoning'),
  content: zod.string().describe('the reasoning content'),
});

const redactedReasoningPartSchema = zod.strictObject({
  type: zod.literal('redacted-reasoning'),
  data: zod.string().describe('the redacted reasoning data'),
});

const reasoningSignaturePartSchema = zod.strictObject({
  type: zod.literal('reasoning-signature'),
  signature: zod.string().describe('the reasoning signature'),
});

const sourcePartSchema = zod.strictObject({
  type: zod.literal('source'),
  sourceType: zod.string().describe('the type of source'),
  id: zod.string().describe('the source identifier'),
  url: zod.string().optional().describe('the source URL'),
  title: zod.string().optional().describe('the source title'),
});

const filePartSchema = zod.strictObject({
  type: zod.literal('file'),
  data: zod.string().describe('the file data'),
  mimeType: zod.string().describe('the MIME type of the file'),
});

const dataPartSchema = zod.strictObject({
  type: zod.literal('data'),
  content: zod.array(zod.unknown()).describe('array of data content'),
});

const messageAnnotationPartSchema = zod.strictObject({
  type: zod.literal('message-annotation'),
  annotations: zod
    .array(zod.unknown())
    .describe('array of message annotations'),
});

const errorPartSchema = zod.strictObject({
  type: zod.literal('error'),
  message: zod.string().describe('the error message'),
});

const toolCallStreamingStartPartSchema = zod.strictObject({
  type: zod.literal('tool-call-streaming-start'),
  toolCallId: zod.string().describe('the tool call identifier'),
  toolName: zod.string().describe('the name of the tool'),
});

const toolCallDeltaPartSchema = zod.strictObject({
  type: zod.literal('tool-call-delta'),
  toolCallId: zod.string().describe('the tool call identifier'),
  argsTextDelta: zod.string().describe('the incremental arguments text'),
});

const toolCallPartSchema = zod.strictObject({
  type: zod.literal('tool-call'),
  toolCallId: zod.string().describe('the tool call identifier'),
  toolName: zod.string().describe('the name of the tool'),
  args: zod.unknown().describe('the tool arguments'),
});

const toolResultPartSchema = zod.strictObject({
  type: zod.literal('tool-result'),
  toolCallId: zod.string().describe('the tool call identifier'),
  result: zod.unknown().describe('the tool result'),
});

const startStepPartSchema = zod.strictObject({
  type: zod.literal('start-step'),
  messageId: zod.string().describe('the message identifier'),
});

const finishStepPartSchema = zod.strictObject({
  type: zod.literal('finish-step'),
  finishReason: finishReasonSchema.describe('the reason for finishing'),
  usage: usageSchema.describe('token usage information'),
  isContinued: zod.boolean().describe('whether the step is continued'),
});

const finishMessagePartSchema = zod.strictObject({
  type: zod.literal('finish-message'),
  finishReason: finishReasonSchema.describe('the reason for finishing'),
  usage: usageSchema.describe('token usage information'),
});

export const streamPartSchema = zod.discriminatedUnion('type', [
  textPartSchema,
  reasoningPartSchema,
  redactedReasoningPartSchema,
  reasoningSignaturePartSchema,
  sourcePartSchema,
  filePartSchema,
  dataPartSchema,
  messageAnnotationPartSchema,
  errorPartSchema,
  toolCallStreamingStartPartSchema,
  toolCallDeltaPartSchema,
  toolCallPartSchema,
  toolResultPartSchema,
  startStepPartSchema,
  finishStepPartSchema,
  finishMessagePartSchema,
]);

export const textPartSchemas = [textPartSchema] as const;
export const reasoningPartSchemas = [reasoningPartSchema] as const;
export const redactedReasoningPartSchemas = [
  redactedReasoningPartSchema,
] as const;
export const reasoningSignaturePartSchemas = [
  reasoningSignaturePartSchema,
] as const;
export const sourcePartSchemas = [sourcePartSchema] as const;
export const filePartSchemas = [filePartSchema] as const;
export const dataPartSchemas = [dataPartSchema] as const;
export const messageAnnotationPartSchemas = [
  messageAnnotationPartSchema,
] as const;
export const errorPartSchemas = [errorPartSchema] as const;
export const toolCallStreamingStartPartSchemas = [
  toolCallStreamingStartPartSchema,
] as const;
export const toolCallDeltaPartSchemas = [toolCallDeltaPartSchema] as const;
export const toolCallPartSchemas = [toolCallPartSchema] as const;
export const toolResultPartSchemas = [toolResultPartSchema] as const;
export const startStepPartSchemas = [startStepPartSchema] as const;
export const finishStepPartSchemas = [finishStepPartSchema] as const;
export const finishMessagePartSchemas = [finishMessagePartSchema] as const;

export type StreamPart = zod.infer<typeof streamPartSchema>;
export type TextPart = zod.infer<typeof textPartSchema>;
export type ReasoningPart = zod.infer<typeof reasoningPartSchema>;
export type RedactedReasoningPart = zod.infer<
  typeof redactedReasoningPartSchema
>;
export type ReasoningSignaturePart = zod.infer<
  typeof reasoningSignaturePartSchema
>;
export type SourcePart = zod.infer<typeof sourcePartSchema>;
export type FilePart = zod.infer<typeof filePartSchema>;
export type DataPart = zod.infer<typeof dataPartSchema>;
export type MessageAnnotationPart = zod.infer<
  typeof messageAnnotationPartSchema
>;
export type ErrorPart = zod.infer<typeof errorPartSchema>;
export type ToolCallStreamingStartPart = zod.infer<
  typeof toolCallStreamingStartPartSchema
>;
export type ToolCallDeltaPart = zod.infer<typeof toolCallDeltaPartSchema>;
export type ToolCallPart = zod.infer<typeof toolCallPartSchema>;
export type ToolResultPart = zod.infer<typeof toolResultPartSchema>;
export type StartStepPart = zod.infer<typeof startStepPartSchema>;
export type FinishStepPart = zod.infer<typeof finishStepPartSchema>;
export type FinishMessagePart = zod.infer<typeof finishMessagePartSchema>;
