import zod from 'zod';
import { finishReasonSchema } from '../../../../response/completions/shared/FinishReason';
import { generatedFileSchema } from '../../../../response/completions/shared/GeneratedFile';
import { providerMetadataSchema } from '../../../../response/completions/shared/ProviderMetadata';
import { providerSourceSchema } from '../../../../response/completions/shared/ProviderSource';
import { reasoningOutputSchema } from '../../../../response/completions/shared/Reasoning';
import { toolCallSchema } from '../../../../response/completions/shared/ToolCall';
import { toolResultSchema } from '../../../../response/completions/shared/ToolResult';
import { usageSchema } from '../../../../response/completions/shared/Usage';
import { warningSchema } from '../../../../response/completions/shared/Warning';

export type OnStepFinishResult = zod.infer<typeof onStepFinishResultSchema>;

/**
 * Response metadata for onStepFinish callback.
 * Includes isContinued to indicate if there will be a continuation step.
 */
export const onStepFinishResponseSchema = zod
  .strictObject({
    id: zod.string().describe('ID for the generated response.'),
    timestamp: zod.coerce
      .date()
      .describe('Timestamp for the start of the generated response.'),
    modelId: zod
      .string()
      .describe(
        'The ID of the response model that was used to generate the response.',
      ),
    headers: zod
      .record(zod.string())
      .optional()
      .describe(
        'Response headers (available only for providers that use HTTP requests).',
      ),
    isContinued: zod
      .boolean()
      .describe(
        'True when there will be a continuation step with a continuation text.',
      ),
  })
  .describe('Metadata about the response including continuation status.');

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
    response: onStepFinishResponseSchema.optional(),
    providerMetadata: providerMetadataSchema.optional(),
  })
  .describe(
    'Result passed to the onStepFinish callback after each step completes.',
  );
