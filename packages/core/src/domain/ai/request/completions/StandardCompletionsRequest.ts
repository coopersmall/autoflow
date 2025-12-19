import zod from 'zod';
import { toolSchema } from '../tools/Tool';
import { toolChoiceSchema } from '../tools/ToolChoice';
import { baseCompletionsRequestSchema } from './BaseCompletionsRequest';

export type StandardCompletionsRequest = zod.infer<
  typeof standardCompletionsRequestSchema
>;

export const standardCompletionsRequestSchema = baseCompletionsRequestSchema
  .extend({
    tools: zod
      .array(toolSchema)
      .optional()
      .describe('Tools available for the model to call.'),
    toolChoice: toolChoiceSchema,
  })
  .describe('Standard completions request with optional tool calling.');
