import zod from 'zod';
import { providerMetadataSchema } from './ProviderMetadata';

export type ReasoningOutput = zod.infer<typeof reasoningOutputSchema>;
export type ReasoningDetail = zod.infer<typeof reasoningDetailSchema>;

export const reasoningOutputSchema = zod
  .strictObject({
    type: zod.literal('reasoning'),
    text: zod.string().describe('The reasoning text.'),
    providerMetadata: providerMetadataSchema.optional(),
  })
  .describe('Reasoning output from the model.');

export const reasoningDetailTextSchema = zod.strictObject({
  type: zod.literal('text'),
  text: zod.string().describe('The text content.'),
  signature: zod.string().optional().describe('Optional signature.'),
});

export const reasoningDetailRedactedSchema = zod.strictObject({
  type: zod.literal('redacted'),
  data: zod.string().describe('The redacted data content.'),
});

export const reasoningDetailSchema = zod
  .discriminatedUnion('type', [
    reasoningDetailTextSchema,
    reasoningDetailRedactedSchema,
  ])
  .describe('Detailed reasoning information.');
