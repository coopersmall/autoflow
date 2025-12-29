import zod from 'zod';
import { messageSchema } from '../../messages/Message';
import { toolChoiceSchema } from '../../tools/ToolChoice';

export type OnStepStartResult = zod.infer<typeof onStepStartResultSchema>;

export const onStepStartResultSchema = zod
  .strictObject({
    toolChoice: toolChoiceSchema.describe(
      'Change the tool choice strategy for this step.',
    ),
    activeTools: zod
      .array(zod.string())
      .optional()
      .describe('Change which tools are active for this step.'),
    system: zod
      .string()
      .optional()
      .describe('Change the system prompt for this step.'),
    messages: zod
      .array(messageSchema)
      .optional()
      .describe('Modify the input messages for this step.'),
  })
  .describe('Result returned from onStepStart to modify the next step.');
