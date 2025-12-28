import {
  stepFinishEventDataSchema,
  stepStartEventDataSchema,
  textDeltaEventDataSchema,
  toolCallEventDataSchema,
  toolResultEventDataSchema,
} from '@core/domain/conversation/events';
import { z as zod } from 'zod';
import { agentIdSchema } from '../AgentId';
import { agentRunIdSchema } from '../AgentRunId';
import { suspensionSchema } from '../suspension/Suspension';
import { agentResultSchema } from './AgentResult';

// Base fields for all agent events
export const agentEventBaseSchema = zod.strictObject({
  // Which agent emitted this event
  manifestId: agentIdSchema,
  // Parent agent (if this is a sub-agent event)
  parentManifestId: agentIdSchema.optional(),
  // Timestamp for ordering
  timestamp: zod.number(),
});

// Streamable event types (configurable via manifest)
export const streamableEventTypes = [
  'tool-call',
  'tool-result',
  'text-delta',
  'step-start',
  'step-finish',
] as const;

export const streamableEventTypeSchema = zod.enum(streamableEventTypes);
export type StreamableEventType = zod.infer<typeof streamableEventTypeSchema>;

// Extend existing event schemas with agent context
export const agentToolCallEventSchema = toolCallEventDataSchema
  .extend(agentEventBaseSchema.shape)
  .extend({ stepNumber: zod.number() });

export const agentToolResultEventSchema = toolResultEventDataSchema
  .extend(agentEventBaseSchema.shape)
  .extend({ stepNumber: zod.number() });

export const agentTextDeltaEventSchema = textDeltaEventDataSchema.extend(
  agentEventBaseSchema.shape,
);

export const agentStepStartEventSchema = stepStartEventDataSchema.extend(
  agentEventBaseSchema.shape,
);

export const agentStepFinishEventSchema = stepFinishEventDataSchema.extend(
  agentEventBaseSchema.shape,
);

// Agent-specific lifecycle events (always emitted, not configurable)
export const agentStartedEventSchema = agentEventBaseSchema.extend({
  type: zod.literal('agent-started'),
  stateId: agentRunIdSchema,
});

export const agentDoneEventSchema = agentEventBaseSchema.extend({
  type: zod.literal('agent-done'),
  result: agentResultSchema,
});

export const agentSuspendedEventSchema = agentEventBaseSchema.extend({
  type: zod.literal('agent-suspended'),
  suspension: suspensionSchema,
  stateId: agentRunIdSchema,
});

export const agentErrorEventSchema = agentEventBaseSchema.extend({
  type: zod.literal('agent-error'),
  error: zod.strictObject({
    code: zod.string(),
    message: zod.string(),
  }),
});

export const agentCancelledEventSchema = agentEventBaseSchema.extend({
  type: zod.literal('agent-cancelled'),
  reason: zod.string().optional(),
});

// Sub-agent lifecycle events (emitted when sub-agents start/end)
export const subAgentStartEventSchema = agentEventBaseSchema.extend({
  type: zod.literal('sub-agent-start'),
  subAgentManifestId: agentIdSchema,
  subAgentToolName: zod.string(),
});

export const subAgentEndEventSchema = agentEventBaseSchema.extend({
  type: zod.literal('sub-agent-end'),
  subAgentManifestId: agentIdSchema,
  subAgentToolName: zod.string(),
  status: zod.enum(['complete', 'error', 'suspended']),
});

// Union of all agent events
export const agentEventSchema = zod.discriminatedUnion('type', [
  // Configurable events (controlled by manifest.streaming.events)
  agentToolCallEventSchema,
  agentToolResultEventSchema,
  agentTextDeltaEventSchema,
  agentStepStartEventSchema,
  agentStepFinishEventSchema,
  // Lifecycle events (always emitted)
  agentStartedEventSchema,
  agentDoneEventSchema,
  agentSuspendedEventSchema,
  agentErrorEventSchema,
  agentCancelledEventSchema,
  subAgentStartEventSchema,
  subAgentEndEventSchema,
]);

export type AgentEvent = zod.infer<typeof agentEventSchema>;
