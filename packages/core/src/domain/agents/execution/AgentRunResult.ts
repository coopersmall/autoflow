import type { AppError } from '@core/errors/AppError';
import { z as zod } from 'zod';
import { agentStateIdSchema } from '../AgentStateId';
import { suspensionSchema } from '../suspension/Suspension';
import { agentResultSchema } from './AgentResult';

export const agentRunResultSchema = zod.discriminatedUnion('status', [
  zod.strictObject({
    status: zod.literal('complete'),
    result: agentResultSchema,
  }),
  zod.strictObject({
    status: zod.literal('suspended'),
    suspension: suspensionSchema,
    stateId: agentStateIdSchema,
  }),
  zod.strictObject({
    status: zod.literal('error'),
    error: zod.custom<AppError>(),
  }),
]);

export type AgentRunResult = zod.infer<typeof agentRunResultSchema>;
