import { agentIdSchema, agentRunIdSchema } from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onAgentCancelled hook.
 * Called when an agent is cancelled.
 */
export const agentCancelledParamsSchema = zod.strictObject({
  manifestId: agentIdSchema,
  manifestVersion: zod.string(),
  stateId: agentRunIdSchema,
  reason: zod.string().optional(),
  /** Present when invoked as a sub-agent */
  parentManifestId: agentIdSchema.optional(),
  /** Present when invoked as a sub-agent */
  parentManifestVersion: zod.string().optional(),
  /** Present when invoked as a sub-agent */
  toolCallId: zod.string().optional(),
});

export type AgentCancelledParams = zod.infer<typeof agentCancelledParamsSchema>;
