import { agentIdSchema, agentRunIdSchema } from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onSubAgentStart hook.
 * Called on the parent manifest when a sub-agent starts.
 *
 * STATE GUARANTEE: At hook invocation time, BOTH parent and child states exist
 * in the cache. The hook is fired AFTER receiving the agent-started event from
 * the child, ensuring the child state has been created.
 */
export const subAgentStartParamsSchema = zod.strictObject({
  parentManifestId: agentIdSchema,
  parentManifestVersion: zod.string(),
  parentStateId: agentRunIdSchema,
  childManifestId: agentIdSchema,
  childManifestVersion: zod.string(),
  childStateId: agentRunIdSchema,
  toolCallId: zod.string(),
});

export type SubAgentStartParams = zod.infer<typeof subAgentStartParamsSchema>;
