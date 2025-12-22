import zod from 'zod';
import { attachmentSchema } from '../shared/Attachment';
import { sourceSchema } from '../shared/Source';
import { toolCallResultSchema } from '../shared/ToolCallResult';

/**
 * Content produced within a single step of agent execution.
 * This is the atomic unit of content that accumulates during streaming.
 */
export const stepContentSchema = zod.strictObject({
  text: zod.string().optional().describe('The accumulated text content'),
  reasoning: zod.string().optional().describe('The accumulated reasoning text'),
  tools: zod
    .array(toolCallResultSchema)
    .optional()
    .describe('Tool calls and their results'),
  sources: zod.array(sourceSchema).optional().describe('Sources referenced'),
  files: zod.array(attachmentSchema).optional().describe('Files generated'),
});

export type StepContent = zod.infer<typeof stepContentSchema>;
