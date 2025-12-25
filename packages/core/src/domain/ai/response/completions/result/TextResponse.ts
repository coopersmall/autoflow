import { requestAssistantContentPartSchema } from '@core/domain/ai/request';
import zod from 'zod';
import { finishReasonSchema } from '../shared/FinishReason';
import { generatedFileSchema } from '../shared/GeneratedFile';
import { providerMetadataSchema } from '../shared/ProviderMetadata';
import { providerSourceSchema } from '../shared/ProviderSource';
import { reasoningOutputSchema } from '../shared/Reasoning';
import { requestMetadataSchema } from '../shared/RequestMetadata';
import { responseMetadataSchema } from '../shared/ResponseMetadata';
import { toolCallSchema } from '../shared/ToolCall';
import { toolResultSchema } from '../shared/ToolResult';
import { usageSchema } from '../shared/Usage';
import { warningSchema } from '../shared/Warning';
import { stepResultSchema } from './StepResult';

export type TextResponse = zod.infer<typeof textResponseSchema>;

export const textResponseSchema = zod
  .strictObject({
    // Content
    text: zod.string().describe('The generated text.'),
    content: zod
      .array(requestAssistantContentPartSchema)
      .describe('The generated content parts.'),
    reasoning: zod
      .array(reasoningOutputSchema)
      .describe('The reasoning from the last step.'),
    reasoningText: zod
      .string()
      .optional()
      .describe('The reasoning text from the last step.'),
    sources: zod
      .array(providerSourceSchema)
      .describe('Sources used (accumulated from all steps).'),
    files: zod
      .array(generatedFileSchema)
      .describe('Files generated in the final step.'),

    // Tool interactions
    toolCalls: zod
      .array(toolCallSchema)
      .describe('Tool calls from the last step.'),
    toolResults: zod
      .array(toolResultSchema)
      .describe('Tool results from the last step.'),

    // Completion info
    finishReason: finishReasonSchema.describe('Why generation stopped.'),

    // Usage
    usage: usageSchema.describe('Token usage for the last step.'),
    totalUsage: usageSchema.describe('Total token usage across all steps.'),

    // Metadata
    request: requestMetadataSchema.optional(),
    response: responseMetadataSchema.optional(),
    warnings: zod.array(warningSchema).optional(),
    providerMetadata: providerMetadataSchema.optional(),

    // Multi-step
    steps: zod.array(stepResultSchema).describe('Results for each step.'),
  })
  .describe('Final response from generateText or streamText.');
