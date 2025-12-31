import {
  finishReasonSchema,
  generatedFileSchema,
  providerMetadataSchema,
  providerSourceSchema,
  reasoningOutputSchema,
  responseMetadataSchema,
  toolCallSchema,
  toolResultSchema,
  usageSchema,
  warningSchema,
} from '@core/domain/ai/response';
import zod from 'zod';

export type OnStepFinishResult = zod.infer<typeof onStepFinishResultSchema>;

export const onStepFinishResultSchema = zod
  .strictObject({
    text: zod.string().describe('The full text that has been generated.'),
    reasoning: zod
      .array(reasoningOutputSchema)
      .describe('The reasoning generated.'),
    reasoningText: zod.string().optional().describe('The reasoning text.'),
    files: zod.array(generatedFileSchema).describe('Files generated.'),
    sources: zod.array(providerSourceSchema).describe('Sources used.'),
    toolCalls: zod.array(toolCallSchema).describe('Tool calls made.'),
    toolResults: zod.array(toolResultSchema).describe('Tool results.'),
    finishReason: finishReasonSchema,
    usage: usageSchema,
    warnings: zod.array(warningSchema).optional(),
    response: responseMetadataSchema.optional(),
    providerMetadata: providerMetadataSchema.optional(),
  })
  .describe(
    'Result passed to the onStepFinish callback after each step completes.',
  );
