import type { AppError } from '@core/errors/AppError';
import { z as zod } from 'zod';
import { agentRunIdSchema } from '../AgentRunId';
import { suspensionSchema, suspensionStackSchema } from '../suspension';
import { agentResultSchema } from './AgentResult';

const agentRunResultCompleteSchema = zod.strictObject({
  status: zod.literal('complete'),
  result: agentResultSchema,
  runId: agentRunIdSchema,
});

const agentRunResultSuspendedSchema = zod.strictObject({
  status: zod.literal('suspended'),
  suspensions: zod.array(suspensionSchema),
  suspensionStacks: zod.array(suspensionStackSchema),
  runId: agentRunIdSchema,
});

const agentRunResultErrorSchema = zod.strictObject({
  status: zod.literal('error'),
  error: zod.custom<AppError>(),
  runId: agentRunIdSchema,
});

export const agentRunResultSchema = zod.discriminatedUnion('status', [
  agentRunResultCompleteSchema,
  agentRunResultSuspendedSchema,
  agentRunResultErrorSchema,
]);

export const agentRunResultNonSuspendedSchema = zod.discriminatedUnion(
  'status',
  [agentRunResultCompleteSchema, agentRunResultErrorSchema],
);

export type AgentRunResult = zod.infer<typeof agentRunResultSchema>;

export type AgentRunResultNonSuspended = zod.infer<
  typeof agentRunResultNonSuspendedSchema
>;
