import {
  agentIdSchema,
  agentResultSchema,
  agentRunIdSchema,
} from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onSubAgentComplete hook.
 * Called on the parent manifest when a sub-agent completes successfully.
 */
export const subAgentCompleteParamsSchema = zod.strictObject({
  parentManifestId: agentIdSchema,
  parentManifestVersion: zod.string(),
  parentStateId: agentRunIdSchema,
  childManifestId: agentIdSchema,
  childManifestVersion: zod.string(),
  childStateId: agentRunIdSchema,
  toolCallId: zod.string(),
  result: agentResultSchema,
});

export type SubAgentCompleteParams = Readonly<
  zod.infer<typeof subAgentCompleteParamsSchema>
>;
