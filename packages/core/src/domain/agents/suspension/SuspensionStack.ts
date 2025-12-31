import { z as zod } from 'zod';
import { agentIdSchema } from '../AgentId';
import { agentRunIdSchema } from '../AgentRunId';
import { toolApprovalSuspensionSchema } from './Suspension';

export const suspensionStackEntrySchema = zod.strictObject({
  manifestId: agentIdSchema,
  manifestVersion: zod.string(),
  stateId: agentRunIdSchema,
  pendingToolCallId: zod
    .string()
    .optional()
    .describe(
      'The tool call waiting for sub-agent result (undefined for leaf)',
    ),
});

export const suspensionStackSchema = zod.strictObject({
  // Stack of suspended agents, from root (first) to deepest (last)
  // The deepest agent is the one that actually triggered the suspension
  agents: zod.array(suspensionStackEntrySchema),

  // The actual suspension at the leaf (deepest agent)
  leafSuspension: toolApprovalSuspensionSchema,
});

export type SuspensionStack = zod.infer<typeof suspensionStackSchema>;
export type SuspensionStackEntry = zod.infer<typeof suspensionStackEntrySchema>;
