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

export type StepResult = zod.infer<typeof stepResultSchema>;

export const stepResultSchema = zod
  .strictObject({
    text: zod.string().describe('The generated text.'),
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
    request: requestMetadataSchema,
    response: responseMetadataSchema,
    providerMetadata: providerMetadataSchema.optional(),
  })
  .describe('Result of a single generation step.');
