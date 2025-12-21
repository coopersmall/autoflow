import zod from 'zod';

export type ToolChoice = zod.infer<typeof toolChoiceSchema>;

export const toolChoiceAutoSchema = zod.literal('auto');
export const toolChoiceNoneSchema = zod.literal('none');
export const toolChoiceRequiredSchema = zod.literal('required');

export const toolChoiceSpecificSchema = zod
  .strictObject({
    type: zod.literal('tool'),
    toolName: zod.string().describe('The name of the specific tool to use.'),
  })
  .describe('Require a specific tool to be called.');

export const toolChoiceSchema = zod
  .union([
    toolChoiceAutoSchema,
    toolChoiceNoneSchema,
    toolChoiceRequiredSchema,
    toolChoiceSpecificSchema,
  ])
  .optional()
  .describe(
    'Tool choice strategy. "auto" lets the model decide, "none" disables tools, "required" forces tool use, or specify a tool name.',
  );
