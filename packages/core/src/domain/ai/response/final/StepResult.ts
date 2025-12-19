import zod from 'zod';
import { finishReasonSchema } from '../shared/FinishReason';
import { generatedFileSchema } from '../shared/GeneratedFile';
import { providerMetadataSchema } from '../shared/ProviderMetadata';
import { reasoningOutputSchema } from '../shared/Reasoning';
import { requestMetadataSchema } from '../shared/RequestMetadata';
import { responseMetadataSchema } from '../shared/ResponseMetadata';
import { sourceSchema } from '../shared/Source';
import { toolCallSchema } from '../shared/ToolCall';
import { toolResultSchema } from '../shared/ToolResult';
import { usageSchema } from '../shared/Usage';
import { warningSchema } from '../shared/Warning';

export type StepType = zod.infer<typeof stepTypeSchema>;
export type StepResult = zod.infer<typeof stepResultSchema>;

export const stepTypeSchema = zod.enum(['initial', 'continue', 'tool-result']);

export const stepResultSchema = zod
  .strictObject({
    stepType: stepTypeSchema.describe('The type of step.'),
    text: zod.string().describe('The generated text.'),
    reasoning: zod
      .array(reasoningOutputSchema)
      .describe('The reasoning generated.'),
    reasoningText: zod.string().optional().describe('The reasoning text.'),
    sources: zod.array(sourceSchema).describe('Sources used.'),
    files: zod.array(generatedFileSchema).describe('Files generated.'),
    toolCalls: zod.array(toolCallSchema).describe('Tool calls made.'),
    toolResults: zod.array(toolResultSchema).describe('Tool results.'),
    finishReason: finishReasonSchema,
    usage: usageSchema,
    request: requestMetadataSchema,
    response: responseMetadataSchema,
    warnings: zod.array(warningSchema).optional(),
    isContinued: zod.boolean().describe('Whether the step will continue.'),
    providerMetadata: providerMetadataSchema.optional(),
  })
  .describe('Result of a single generation step.');
