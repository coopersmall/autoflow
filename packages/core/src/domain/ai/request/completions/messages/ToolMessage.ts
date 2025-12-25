import zod from 'zod';
import { requestToolContentPartSchema } from '../content/ContentPart';

export type ToolMessage = zod.infer<typeof toolMessageSchema>;

export const toolMessageSchema = zod
  .strictObject({
    role: zod.literal('tool'),
    content: zod
      .array(requestToolContentPartSchema)
      .describe('Array of tool results and approval responses.'),
  })
  .describe(
    'Tool message containing results from tool executions and approval responses.',
  );
