import { agentIdSchema, agentRunIdSchema } from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onSubAgentError hook.
 * Called on the parent manifest when a sub-agent errors.
 */
export const subAgentErrorParamsSchema = zod.strictObject({
  parentManifestId: agentIdSchema,
  parentManifestVersion: zod.string(),
  parentStateId: agentRunIdSchema,
  childManifestId: agentIdSchema,
  childManifestVersion: zod.string(),
  childStateId: agentRunIdSchema,
  toolCallId: zod.string(),
  error: zod.strictObject({
    code: zod.string(),
    message: zod.string(),
  }),
});

export type SubAgentErrorParams = Readonly<
  zod.infer<typeof subAgentErrorParamsSchema>
>;
