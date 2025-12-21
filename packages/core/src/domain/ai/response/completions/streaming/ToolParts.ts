import zod from 'zod';
import { providerMetadataSchema } from '../shared/ProviderMetadata';

// === TOOL INPUT STREAMING PARTS ===

export type ToolInputStartPart = zod.infer<typeof toolInputStartPartSchema>;
export const toolInputStartPartSchema = zod.strictObject({
  type: zod.literal('tool-input-start'),
  id: zod.string(),
  toolName: zod.string(),
  providerMetadata: providerMetadataSchema.optional(),
  providerExecuted: zod.boolean().optional(),
  dynamic: zod.boolean().optional(),
});

export type ToolInputEndPart = zod.infer<typeof toolInputEndPartSchema>;
export const toolInputEndPartSchema = zod.strictObject({
  type: zod.literal('tool-input-end'),
  id: zod.string(),
  providerMetadata: providerMetadataSchema.optional(),
});

export type ToolInputDeltaPart = zod.infer<typeof toolInputDeltaPartSchema>;
export const toolInputDeltaPartSchema = zod.strictObject({
  type: zod.literal('tool-input-delta'),
  id: zod.string(),
  delta: zod.string(),
  providerMetadata: providerMetadataSchema.optional(),
});

// === TOOL CALL PART ===

export type ToolCallPart = zod.infer<typeof toolCallPartSchema>;
export const toolCallPartSchema = zod.strictObject({
  type: zod.literal('tool-call'),
  toolCallId: zod.string(),
  toolName: zod.string(),
  input: zod.unknown(),
  providerExecuted: zod.boolean().optional(),
  dynamic: zod.boolean().optional(),
  invalid: zod.boolean().optional(),
  error: zod.unknown().optional(),
  providerMetadata: providerMetadataSchema.optional(),
});

// === TOOL RESULT PART ===

export type ToolResultPart = zod.infer<typeof toolResultPartSchema>;
export const toolResultPartSchema = zod.strictObject({
  type: zod.literal('tool-result'),
  toolCallId: zod.string(),
  toolName: zod.string(),
  input: zod.unknown(),
  output: zod.unknown(),
  providerExecuted: zod.boolean().optional(),
  dynamic: zod.boolean().optional(),
  preliminary: zod.boolean().optional(),
  providerMetadata: providerMetadataSchema.optional(),
});

// === TOOL ERROR PART ===

export type ToolErrorPart = zod.infer<typeof toolErrorPartSchema>;
export const toolErrorPartSchema = zod.strictObject({
  type: zod.literal('tool-error'),
  toolCallId: zod.string(),
  toolName: zod.string(),
  input: zod.unknown(),
  error: zod.unknown(),
  providerExecuted: zod.boolean().optional(),
  dynamic: zod.boolean().optional(),
  providerMetadata: providerMetadataSchema.optional(),
});
