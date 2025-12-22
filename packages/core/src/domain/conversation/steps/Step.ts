import zod from 'zod';
import { finishReasonSchema, usageSchema } from '../../ai/response';
import { stepContentSchema } from './StepContent';

/**
 * A single step in an agent's execution.
 * Each step represents one round of model interaction, including:
 * - Content produced (text, reasoning, tool calls, sources, files)
 * - Usage metrics for this step
 * - Why the step finished
 * - Timing information
 */
export const stepSchema = zod.strictObject({
  stepIndex: zod
    .number()
    .int()
    .min(0)
    .describe('Zero-based index of this step within the agent execution'),
  content: stepContentSchema.describe('Content produced in this step'),
  usage: usageSchema.describe('Token usage for this step'),
  finishReason: finishReasonSchema.describe('Why this step finished'),
  isContinued: zod
    .boolean()
    .optional()
    .describe('Whether this step continues in another step'),
  startedAt: zod.coerce.date().describe('When this step started'),
  finishedAt: zod.coerce.date().describe('When this step finished'),
});

export type Step = zod.infer<typeof stepSchema>;
