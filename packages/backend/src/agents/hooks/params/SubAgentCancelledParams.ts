import { agentIdSchema, agentRunIdSchema } from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onSubAgentCancelled hook.
 * Called on the parent manifest when a sub-agent is cancelled.
 */
export const subAgentCancelledParamsSchema = zod.strictObject({
  parentManifestId: agentIdSchema,
  parentManifestVersion: zod.string(),
  parentStateId: agentRunIdSchema,
  childManifestId: agentIdSchema,
  childManifestVersion: zod.string(),
  childStateId: agentRunIdSchema,
  toolCallId: zod.string(),
  reason: zod.string().optional(),
});

export type SubAgentCancelledParams = Readonly<
  zod.infer<typeof subAgentCancelledParamsSchema>
>;
