import zod from 'zod';
import { generatedFileSchema } from '../shared/GeneratedFile';
import { providerMetadataSchema } from '../shared/ProviderMetadata';

export type TextPart = zod.infer<typeof textPartSchema>;
export type ReasoningPart = zod.infer<typeof reasoningPartSchema>;
export type ReasoningPartFinish = zod.infer<typeof reasoningPartFinishSchema>;
export type SourcePart = zod.infer<typeof sourcePartSchema>;
export type FilePart = zod.infer<typeof filePartSchema>;

export const textPartSchema = zod.strictObject({
  type: zod.literal('text'),
  text: zod.string().describe('The text content.'),
});

export const reasoningPartSchema = zod.strictObject({
  type: zod.literal('reasoning'),
  text: zod.string().describe('The reasoning text delta.'),
  providerMetadata: providerMetadataSchema.optional(),
});

export const reasoningPartFinishSchema = zod.strictObject({
  type: zod.literal('reasoning-part-finish'),
});

export const sourcePartSchema = zod.strictObject({
  type: zod.literal('source'),
  sourceType: zod.literal('url'),
  id: zod.string(),
  url: zod.string(),
  title: zod.string().optional(),
  providerMetadata: providerMetadataSchema.optional(),
});

export const filePartSchema = zod.strictObject({
  type: zod.literal('file'),
  file: generatedFileSchema,
});
