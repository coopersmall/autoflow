import { agentIdSchema, agentRunIdSchema } from '@core/domain/agents';
import {
  suspensionStackSchema,
  toolApprovalSuspensionSchema,
} from '@core/domain/agents/suspension';
import { messageSchema } from '@core/domain/ai/request/completions';
import { requestToolResultPartSchema } from '@core/domain/ai/request/completions/content';
import { stepResultSchema } from '@core/domain/ai/response/completions/result';
import { z as zod } from 'zod';
import { parentAgentContextSchema } from './ParentAgentContext';

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

  // Parent agent context (for resume scenarios - enables consistent parent info)
  parentContext: parentAgentContextSchema.optional(),

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
    .describe('Pending suspensions for THIS agent (flat HITL)'),
  suspensionStacks: zod
    .array(suspensionStackSchema)
    .default([])
    .describe(
      'Stacks for nested sub-agent suspensions (one per parallel branch)',
    ),
  pendingToolResults: zod
    .array(requestToolResultPartSchema)
    .default([])
    .describe(
      'Completed tool results waiting for sibling suspensions to resolve',
    ),

  // Lifecycle
  status: zod.enum([
    'suspended',
    'running',
    'completed',
    'failed',
    'cancelled',
  ]),

  // When execution started (set when status transitions to 'running')
  // Used for crash detection: if we can acquire lock but state is 'running'
  // and execution duration > lock TTL, the agent crashed
  startedAt: zod.date().optional(),

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

export type AgentState = Readonly<zod.infer<typeof agentStateSchema>>;
export type AgentStateStatus = AgentState['status'];

/**
 * Agent states that support continuation via reply or approval.
 * - 'completed': Can receive a reply to continue conversation
 * - 'suspended': Can receive an approval response to resume
 *
 * Excludes:
 * - 'running': Transient state (not persisted for continuation)
 * - 'failed': Terminal state (cannot continue)
 * - 'cancelled': Terminal state (cannot continue)
 */
export type ContinuableStateStatus = Extract<
  AgentStateStatus,
  'completed' | 'suspended'
>;
