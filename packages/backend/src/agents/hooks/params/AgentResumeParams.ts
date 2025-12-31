import {
  agentIdSchema,
  agentRunIdSchema,
  suspensionSchema,
} from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Parameters passed to onAgentResume hook.
 * Called when resuming from suspension (not fresh starts - see AgentStartParams).
 *
 * STATE GUARANTEE: At hook invocation time, the agent state EXISTS in the cache
 * and can be looked up by stateId. The state has status 'running'.
 */
export const agentResumeParamsSchema = zod.strictObject({
  manifestId: agentIdSchema,
  manifestVersion: zod.string(),
  stateId: agentRunIdSchema,
  resolvedSuspensions: zod.array(suspensionSchema),
  /** Present when invoked as a sub-agent */
  parentManifestId: agentIdSchema.optional(),
  /** Present when invoked as a sub-agent */
  parentManifestVersion: zod.string().optional(),
  /** Present when invoked as a sub-agent */
  toolCallId: zod.string().optional(),
});

export type AgentResumeParams = Readonly<
  zod.infer<typeof agentResumeParamsSchema>
>;
