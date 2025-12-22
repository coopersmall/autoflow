import zod from 'zod';
import { usageSchema } from '../../ai/response';

/**
 * Summary of an agent execution tree.
 * Attached to assistant messages to provide high-level metrics.
 */
export const summarySchema = zod.strictObject({
  totalUsage: usageSchema.describe('Aggregated token usage across all agents'),
  agentCount: zod
    .number()
    .int()
    .min(1)
    .describe('Number of agents that executed'),
  stepCount: zod
    .number()
    .int()
    .min(1)
    .describe('Total number of steps across all agents'),
});

export type Summary = zod.infer<typeof summarySchema>;
