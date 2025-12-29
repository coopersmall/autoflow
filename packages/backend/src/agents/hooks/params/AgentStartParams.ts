import { agentIdSchema, agentRunIdSchema } from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onAgentStart hook.
 * Called for fresh starts only (not resumes - see AgentResumeParams).
 *
 * STATE GUARANTEE: At hook invocation time, the agent state EXISTS in the cache
 * and can be looked up by stateId. The state has status 'running'.
 */
export const agentStartParamsSchema = zod.strictObject({
  manifestId: agentIdSchema,
  manifestVersion: zod.string(),
  stateId: agentRunIdSchema,
  /** Present when invoked as a sub-agent */
  parentManifestId: agentIdSchema.optional(),
  /** Present when invoked as a sub-agent */
  parentManifestVersion: zod.string().optional(),
  /** Present when invoked as a sub-agent */
  toolCallId: zod.string().optional(),
});

export type AgentStartParams = zod.infer<typeof agentStartParamsSchema>;
