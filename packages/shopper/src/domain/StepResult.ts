import zod from 'zod';
import { stepResultIdSchema } from './StepResultId';

export const stepResultStatusSchema = zod.enum(['success', 'timeout', 'error']);
export type StepResultStatus = zod.infer<typeof stepResultStatusSchema>;

export const stepResultSchema = zod.object({
  id: stepResultIdSchema,
  stepIndex: zod
    .number()
    .int()
    .min(0)
    .describe('zero-based index of the step in the scenario'),
  messageSent: zod.string().describe('the message that was sent'),
  responseReceived: zod
    .string()
    .optional()
    .describe('the text content of the chat response'),
  status: stepResultStatusSchema.describe('outcome of the step execution'),
  error: zod.string().optional().describe('error message if the step failed'),
  startedAt: zod.coerce.date().describe('when the step execution started'),
  completedAt: zod.coerce.date().describe('when the step execution completed'),
  durationMs: zod
    .number()
    .min(0)
    .describe('total duration of the step in milliseconds'),
});
export type StepResult = zod.infer<typeof stepResultSchema>;
