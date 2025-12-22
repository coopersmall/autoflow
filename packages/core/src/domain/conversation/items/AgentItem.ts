import zod from 'zod';
import { aiProviderSchema } from '../../ai/providers/AIProviders';
import { finishReasonSchema, usageSchema } from '../../ai/response';
import { createItemSchema } from '../../Item';
import { conversationIdSchema } from '../Conversation';
import { stepSchema } from '../steps/Step';
import { conversationItemIdSchema } from './ConversationItemId';

// === BASE SCHEMA ===

const baseConversationItemSchema = createItemSchema(
  conversationItemIdSchema,
).extend({
  conversationId: conversationIdSchema.describe(
    'The ID of the conversation this item belongs to',
  ),
  turnIndex: zod
    .number()
    .int()
    .min(0)
    .describe('The turn index within the conversation'),
  metadata: zod
    .record(zod.string(), zod.unknown())
    .optional()
    .describe('Additional metadata for the conversation item'),
});

// === ERROR SCHEMA ===

const errorSchema = zod.strictObject({
  message: zod.string().describe('The error message'),
  code: zod.string().optional().describe('The error code'),
  details: zod.unknown().optional().describe('Additional error details'),
});

export type ItemError = zod.infer<typeof errorSchema>;

// === AGENT RESULT VARIANTS ===

// Agent result variants (discriminated by status)
export const agentCompleteResultSchema = zod.strictObject({
  status: zod.literal('complete'),
  steps: zod.array(stepSchema).describe('All steps executed by this agent'),
  totalUsage: usageSchema.describe('Aggregated token usage across all steps'),
  finishReason: finishReasonSchema.describe('Why the agent finished'),
});

export type AgentCompleteResult = zod.infer<typeof agentCompleteResultSchema>;

export const agentErrorResultSchema = zod.strictObject({
  status: zod.literal('error'),
  steps: zod
    .array(stepSchema)
    .describe('Steps executed before the error occurred'),
  error: errorSchema.describe('The error that caused the agent to fail'),
});

export type AgentErrorResult = zod.infer<typeof agentErrorResultSchema>;

export const agentAbortedResultSchema = zod.strictObject({
  status: zod.literal('aborted'),
  steps: zod
    .array(stepSchema)
    .describe('Steps executed before the agent was aborted'),
});

export type AgentAbortedResult = zod.infer<typeof agentAbortedResultSchema>;

// Agent result union
export const agentResultSchema = zod.discriminatedUnion('status', [
  agentCompleteResultSchema,
  agentErrorResultSchema,
  agentAbortedResultSchema,
]);

export type AgentResult = zod.infer<typeof agentResultSchema>;

// === AGENT ITEM ===

// Agent item
export const agentItemSchema = baseConversationItemSchema.extend({
  type: zod.literal('agent'),
  agentId: zod.string().describe('Identifier for the agent that executed'),
  provider: aiProviderSchema.describe('The AI provider used'),
  model: zod.string().describe('The AI model used'),
  parentAgentItemId: conversationItemIdSchema
    .optional()
    .describe('ID of the parent agent item (for nested agents)'),
  triggeredByToolCallId: zod
    .string()
    .optional()
    .describe('ID of the tool call that triggered this agent'),
  startedAt: zod.coerce.date().describe('When the agent started executing'),
  finishedAt: zod.coerce.date().describe('When the agent finished executing'),
  result: agentResultSchema.describe('The execution result'),
});

export type AgentItem = zod.infer<typeof agentItemSchema>;
