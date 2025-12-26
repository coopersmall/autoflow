import { z as zod } from 'zod';
import { type AgentRunId, agentRunIdSchema } from '../AgentRunId';
import type { Suspension } from '../suspension/Suspension';
import { suspensionSchema } from '../suspension/Suspension';

export const agentToolResultSuccessSchema = zod.strictObject({
  type: zod.literal('success'),
  value: zod.unknown(),
});

export const agentToolResultErrorSchema = zod.strictObject({
  type: zod.literal('error'),
  error: zod.string(),
  code: zod.string().optional(),
  retryable: zod.boolean().optional(),
});

export const agentToolResultSuspendedSchema = zod.strictObject({
  type: zod.literal('suspended'),
  suspensions: zod.array(suspensionSchema),
  runId: agentRunIdSchema,
});

export const agentToolResultSchema = zod.discriminatedUnion('type', [
  agentToolResultSuccessSchema,
  agentToolResultErrorSchema,
  agentToolResultSuspendedSchema,
]);

export type AgentToolResult = zod.infer<typeof agentToolResultSchema>;

// Export individual variants for type narrowing
export type AgentToolResultSuccess = zod.infer<
  typeof agentToolResultSuccessSchema
>;
export type AgentToolResultError = zod.infer<typeof agentToolResultErrorSchema>;
export type AgentToolResultSuspended = zod.infer<
  typeof agentToolResultSuspendedSchema
>;

// Convenience type for results that can be converted to LLM format (not suspended)
export type CompletedAgentToolResult =
  | AgentToolResultSuccess
  | AgentToolResultError;

// Convenience constructors
export const AgentToolResult = {
  success: (value: unknown): AgentToolResultSuccess => ({
    type: 'success',
    value,
  }),
  error: (
    error: string,
    code?: string,
    retryable?: boolean,
  ): AgentToolResultError => ({
    type: 'error',
    error,
    code,
    retryable,
  }),
  suspended: (
    suspensions: Suspension[],
    runId: AgentRunId,
  ): AgentToolResultSuspended => ({
    type: 'suspended',
    suspensions,
    runId,
  }),
};
