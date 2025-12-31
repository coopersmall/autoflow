import zod from 'zod';
import { stepResultSchema } from '../../../../response/completions/result/StepResult';
import { messageSchema } from '../../messages/Message';

export type OnStepStartOptions = zod.infer<typeof onStepStartOptionsSchema>;

export const onStepStartOptionsSchema = zod
  .strictObject({
    steps: zod
      .array(stepResultSchema)
      .describe('The steps that have been executed so far.'),
    stepNumber: zod
      .number()
      .int()
      .nonnegative()
      .describe('The number of the step that is being executed.'),
    provider: zod
      .string()
      .describe(
        'The AI provider being used (e.g., openai, anthropic, google).',
      ),
    model: zod.string().describe('The model identifier being used.'),
    messages: zod
      .array(messageSchema)
      .describe(
        'The messages that will be sent to the model for the current step.',
      ),
  })
  .describe('Options provided to the onStepStart callback before each step.');
