import {
  agentIdSchema,
  agentRunIdSchema,
  suspensionSchema,
} from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onSubAgentSuspend hook.
 * Called on the parent manifest when a sub-agent suspends.
 */
export const subAgentSuspendParamsSchema = zod.strictObject({
  parentManifestId: agentIdSchema,
  parentManifestVersion: zod.string(),
  parentStateId: agentRunIdSchema,
  childManifestId: agentIdSchema,
  childManifestVersion: zod.string(),
  childStateId: agentRunIdSchema,
  toolCallId: zod.string(),
  suspensions: zod.array(suspensionSchema),
});

export type SubAgentSuspendParams = zod.infer<
  typeof subAgentSuspendParamsSchema
>;
