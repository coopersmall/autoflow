import { jsonSchema } from '@core/domain/json-schema/JsonSchema';
import zod from 'zod';
import { executeFunctionSchema } from '../hooks';

export type Tool = zod.infer<typeof toolSchema>;

export const toolSchema = zod
  .strictObject({
    type: zod.literal('function'),
    function: zod.strictObject({
      name: zod.string().describe('The name of the tool.'),
      description: zod
        .string()
        .describe('A description of what the tool does.'),
      parameters: jsonSchema.describe('JSON Schema for the tool parameters.'),
      strict: zod
        .boolean()
        .optional()
        .describe('Whether to strictly enforce the parameters schema.'),
    }),
  })
  .describe('A tool definition that can be called by the model.');

export const toolWithExecutionSchema = toolSchema.extend({
  execute: executeFunctionSchema.optional(),
});

export type ToolWithExecution = zod.infer<typeof toolWithExecutionSchema>;
