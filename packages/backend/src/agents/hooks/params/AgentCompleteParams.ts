import {
  agentIdSchema,
  agentResultSchema,
  agentRunIdSchema,
} from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onAgentComplete hook.
 * Called when an agent completes successfully.
 */
export const agentCompleteParamsSchema = zod.strictObject({
  manifestId: agentIdSchema,
  manifestVersion: zod.string(),
  stateId: agentRunIdSchema,
  result: agentResultSchema,
  /** Present when invoked as a sub-agent */
  parentManifestId: agentIdSchema.optional(),
  /** Present when invoked as a sub-agent */
  parentManifestVersion: zod.string().optional(),
  /** Present when invoked as a sub-agent */
  toolCallId: zod.string().optional(),
});

export type AgentCompleteParams = zod.infer<typeof agentCompleteParamsSchema>;
