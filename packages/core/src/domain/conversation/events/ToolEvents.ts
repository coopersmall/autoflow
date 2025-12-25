import zod from 'zod';

// === TOOL INPUT STREAMING EVENT DATA ===

/**
 * Tool input streaming events are used exclusively for real-time UI updates
 * during streaming. They allow the UI to show tool arguments as they're being
 * generated character-by-character.
 *
 * These events are NOT accumulated into StepContent because:
 * 1. The complete input is available in the tool-call event
 * 2. They're only meaningful during live streaming
 * 3. Storing deltas would be redundant with the final input
 */
export const toolInputStartEventDataSchema = zod.strictObject({
  type: zod.literal('tool-input-start'),
  id: zod.string(),
  toolName: zod.string(),
});

export const toolInputEndEventDataSchema = zod.strictObject({
  type: zod.literal('tool-input-end'),
  id: zod.string(),
});

export const toolInputDeltaEventDataSchema = zod.strictObject({
  type: zod.literal('tool-input-delta'),
  id: zod.string(),
  delta: zod.string(),
});

// === TOOL CALL EVENT DATA ===

export const toolCallEventDataSchema = zod.strictObject({
  type: zod.literal('tool-call'),
  toolCallId: zod.string(),
  toolName: zod.string(),
  input: zod.unknown(),
  invalid: zod.boolean().optional(),
});

// === TOOL RESULT EVENT DATA ===

export const toolResultEventDataSchema = zod.strictObject({
  type: zod.literal('tool-result'),
  toolCallId: zod.string(),
  toolName: zod.string(),
  input: zod.unknown(),
  output: zod.unknown(),
});

// === TOOL ERROR EVENT DATA ===

export const toolErrorEventDataSchema = zod.strictObject({
  type: zod.literal('tool-error'),
  toolCallId: zod.string(),
  toolName: zod.string(),
  input: zod.unknown(),
  error: zod.unknown(),
});

// === TOOL APPROVAL REQUEST EVENT DATA ===

export const toolApprovalRequestEventDataSchema = zod.strictObject({
  type: zod.literal('tool-approval-request'),
  approvalId: zod.string(),
  toolCall: zod.strictObject({
    toolCallId: zod.string(),
    toolName: zod.string(),
    input: zod.unknown(),
    providerExecuted: zod.boolean().optional(),
    dynamic: zod.boolean().optional(),
  }),
});
