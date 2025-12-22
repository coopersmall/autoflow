import zod from 'zod';
import { baseCompletionsRequestSchema } from './BaseCompletionsRequest';
import {
  executeFunctionSchema,
  onStepFinishFunctionSchema,
  prepareStepFunctionSchema,
  stopWhenSchema,
} from './hooks';
import { toolSchema } from './tools';
import { toolChoiceSchema } from './tools/ToolChoice';

export type StandardCompletionsRequest = zod.infer<
  typeof standardCompletionsRequestSchema
>;

export const standardCompletionsRequestSchema = baseCompletionsRequestSchema
  .extend({
    tools: zod
      .array(
        toolSchema.extend({
          execute: executeFunctionSchema
            .optional()
            .describe(
              'The function to execute the tool. If not provided, the tool is assumed to be external.',
            ),
        }),
      )
      .optional()
      .describe('Tools available for the model to call.'),
    activeTools: zod
      .array(zod.string())
      .optional()
      .describe(
        'List of tool names that are active for this request. If not provided, all tools are active.',
      ),
    stopWhen: zod
      .array(stopWhenSchema)
      .optional()
      .describe('Conditions to stop generation.'),
    toolChoice: toolChoiceSchema,
    prepareStep: prepareStepFunctionSchema
      .optional()
      .describe(
        'Optional function to provide different settings for each step. Can modify tool choice, active tools, system prompt, and messages.',
      ),
    onStepFinish: onStepFinishFunctionSchema
      .optional()
      .describe('Callback that is called when a step is finished.'),
  })
  .describe('Standard completions request with optional tool calling.');
