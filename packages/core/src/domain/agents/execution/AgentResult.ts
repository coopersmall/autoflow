import type { AppError } from '@core/errors/AppError';
import { z as zod } from 'zod';
import { stepResultSchema } from '../../ai/response/completions/result/StepResult';
import { finishReasonSchema } from '../../ai/response/completions/shared/FinishReason';
import { usageSchema } from '../../ai/response/completions/shared/Usage';
import type { AgentId } from '../AgentId';
import { agentIdSchema } from '../AgentId';
import { agentRunIdSchema } from '../AgentRunId';
import { suspensionSchema } from '../suspension/Suspension';

// Reuses existing StepResult, Usage, FinishReason from completions
export const agentResultSchema = zod.strictObject({
  status: zod.literal('complete'),
  manifestId: agentIdSchema,
  provider: zod.string(),
  model: zod.string(),
  text: zod.string().optional().describe('Final text response'),
  output: zod
    .unknown()
    .optional()
    .describe('Structured output from outputTool'),
  steps: zod.array(stepResultSchema), // Reused from completions
  totalUsage: usageSchema, // Reused from completions
  finishReason: finishReasonSchema, // Reused from completions
});

export const agentSuspendedResultSchema = zod.strictObject({
  status: zod.literal('suspended'),
  manifestId: agentIdSchema,
  provider: zod.string(),
  model: zod.string(),
  steps: zod.array(stepResultSchema),
  suspension: suspensionSchema,
  stateId: agentRunIdSchema,
});

export const agentErrorResultSchema = zod.strictObject({
  status: zod.literal('error'),
  manifestId: agentIdSchema,
  provider: zod.string(),
  model: zod.string(),
  steps: zod.array(stepResultSchema),
  error: zod.custom<AppError>(),
});

export const agentAbortedResultSchema = zod.strictObject({
  status: zod.literal('aborted'),
  manifestId: agentIdSchema,
  provider: zod.string(),
  model: zod.string(),
  steps: zod.array(stepResultSchema),
});

export const agentResultUnionSchema = zod.discriminatedUnion('status', [
  agentResultSchema,
  agentSuspendedResultSchema,
  agentErrorResultSchema,
  agentAbortedResultSchema,
]);

export type AgentResult = zod.infer<typeof agentResultSchema>;
export type AgentSuspendedResult = zod.infer<typeof agentSuspendedResultSchema>;
export type AgentErrorResult = zod.infer<typeof agentErrorResultSchema>;
export type AgentAbortedResult = zod.infer<typeof agentAbortedResultSchema>;
export type AgentResultUnion = zod.infer<typeof agentResultUnionSchema>;

/**
 * Factory function to create a properly typed error result.
 * Used by observers and other code that needs to construct error results.
 */
export function createAgentErrorResult(
  manifestId: AgentId,
  error: AppError,
  partialResult: Partial<AgentResult>,
): AgentErrorResult {
  return {
    status: 'error',
    manifestId,
    provider: partialResult.provider ?? 'unknown',
    model: partialResult.model ?? 'unknown',
    steps: partialResult.steps ?? [],
    error,
  };
}
