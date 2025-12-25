import { agentIdSchema, agentRunIdSchema } from '@core/domain/agents';
import {
  suspensionStackSchema,
  toolApprovalSuspensionSchema,
} from '@core/domain/agents/suspension';
import { messageSchema } from '@core/domain/ai/request/completions';
import { stepResultSchema } from '@core/domain/ai/response/completions/result';
import { z as zod } from 'zod';

/**
 * Internal state for agent execution persistence.
 * Stored in AgentStateCache during suspension.
 */
export const agentStateSchema = zod.strictObject({
  id: agentRunIdSchema,

  // Root manifest identity (for the entire run)
  rootManifestId: agentIdSchema,

  // Current manifest identity (may differ for sub-agents)
  manifestId: agentIdSchema,
  manifestVersion: zod.string(),

  // Parent state for nested agents (enables cleanup)
  parentStateId: agentRunIdSchema.optional(),

  // Child state IDs for cleanup on completion/cancellation
  childStateIds: zod.array(agentRunIdSchema).default([]),

  // Execution state
  messages: zod
    .array(messageSchema)
    .describe('Binary content replaced with URLs'),
  steps: zod.array(stepResultSchema).describe('Completed steps'),
  currentStepNumber: zod.number(),

  // Suspension info
  suspensions: zod
    .array(toolApprovalSuspensionSchema)
    .describe('Pending suspensions for this agent'),
  suspensionStack: suspensionStackSchema
    .optional()
    .describe('For sub-agent suspensions'),

  // Lifecycle
  status: zod.enum([
    'suspended',
    'running',
    'completed',
    'failed',
    'cancelled',
  ]),

  // Context from original request
  context: zod.record(zod.string(), zod.unknown()).optional(),

  // Timestamps
  createdAt: zod.date(),
  updatedAt: zod.date(),

  // Schema version for Item interface
  schemaVersion: zod.number().int().min(1).default(1),

  // Timeout tracking (elapsed execution time, not wall clock)
  elapsedExecutionMs: zod.number().default(0),
});

export type AgentState = zod.infer<typeof agentStateSchema>;
export type AgentStateStatus = AgentState['status'];
