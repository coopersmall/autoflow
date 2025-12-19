import zod from 'zod';
import { requestToolResultPartSchema } from '../content/ToolResultPart';

export type ToolMessage = zod.infer<typeof toolMessageSchema>;

export const toolMessageSchema = zod
  .strictObject({
    role: zod.literal('tool'),
    content: zod
      .array(requestToolResultPartSchema)
      .describe('Array of tool results.'),
  })
  .describe('Tool message containing results from tool executions.');
