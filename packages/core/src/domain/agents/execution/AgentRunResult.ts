import type { AppError } from '@core/errors/AppError';
import { z as zod } from 'zod';
import { agentRunIdSchema } from '../AgentRunId';
import { suspensionSchema } from '../suspension/Suspension';
import { agentResultSchema } from './AgentResult';

export const agentRunResultSchema = zod.discriminatedUnion('status', [
  zod.strictObject({
    status: zod.literal('complete'),
    result: agentResultSchema,
    runId: agentRunIdSchema,
  }),
  zod.strictObject({
    status: zod.literal('suspended'),
    suspensions: zod.array(suspensionSchema),
    runId: agentRunIdSchema,
  }),
  zod.strictObject({
    status: zod.literal('error'),
    error: zod.custom<AppError>(),
    runId: agentRunIdSchema,
  }),
]);

export type AgentRunResult = zod.infer<typeof agentRunResultSchema>;
