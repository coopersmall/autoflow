import {
  agentIdSchema,
  agentRunIdSchema,
  suspensionSchema,
} from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onAgentSuspend hook.
 * Called when an agent suspends for human-in-the-loop.
 */
export const agentSuspendParamsSchema = zod.strictObject({
  manifestId: agentIdSchema,
  manifestVersion: zod.string(),
  stateId: agentRunIdSchema,
  suspensions: zod.array(suspensionSchema),
  /** Present when invoked as a sub-agent */
  parentManifestId: agentIdSchema.optional(),
  /** Present when invoked as a sub-agent */
  parentManifestVersion: zod.string().optional(),
  /** Present when invoked as a sub-agent */
  toolCallId: zod.string().optional(),
});

export type AgentSuspendParams = zod.infer<typeof agentSuspendParamsSchema>;
