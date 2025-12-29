import { agentIdSchema } from '@core/domain/agents';
import { z as zod } from 'zod';

/**
 * Schema for parent agent context.
 * Stored in AgentState to enable consistent parent info across suspend/resume.
 */
export const parentAgentContextSchema = zod.strictObject({
  parentManifestId: agentIdSchema,
  parentManifestVersion: zod.string(),
  toolCallId: zod.string(),
});

/**
 * Context about the parent agent when this agent is invoked as a sub-agent.
 * Threaded through the call stack to provide parent info to hooks.
 */
export type ParentAgentContext = zod.infer<typeof parentAgentContextSchema>;
