import {
  documentSourceSchema as baseDocumentSourceSchema,
  urlSourceSchema as baseUrlSourceSchema,
} from '@core/domain/source/Source';
import zod from 'zod';
import { generatedFileSchema } from '../shared/GeneratedFile';
import { providerMetadataSchema } from '../shared/ProviderMetadata';

// === TEXT PARTS ===

export type TextStartPart = zod.infer<typeof textStartPartSchema>;
export const textStartPartSchema = zod.strictObject({
  type: zod.literal('text-start'),
  id: zod.string(),
  providerMetadata: providerMetadataSchema.optional(),
});

export type TextEndPart = zod.infer<typeof textEndPartSchema>;
export const textEndPartSchema = zod.strictObject({
  type: zod.literal('text-end'),
  id: zod.string(),
  providerMetadata: providerMetadataSchema.optional(),
});

export type TextDeltaPart = zod.infer<typeof textDeltaPartSchema>;
export const textDeltaPartSchema = zod.strictObject({
  type: zod.literal('text-delta'),
  id: zod.string(),
  text: zod.string(),
  providerMetadata: providerMetadataSchema.optional(),
});

// === REASONING PARTS ===

export type ReasoningStartPart = zod.infer<typeof reasoningStartPartSchema>;
export const reasoningStartPartSchema = zod.strictObject({
  type: zod.literal('reasoning-start'),
  id: zod.string(),
  providerMetadata: providerMetadataSchema.optional(),
});

export type ReasoningEndPart = zod.infer<typeof reasoningEndPartSchema>;
export const reasoningEndPartSchema = zod.strictObject({
  type: zod.literal('reasoning-end'),
  id: zod.string(),
  providerMetadata: providerMetadataSchema.optional(),
});

export type ReasoningDeltaPart = zod.infer<typeof reasoningDeltaPartSchema>;
export const reasoningDeltaPartSchema = zod.strictObject({
  type: zod.literal('reasoning-delta'),
  id: zod.string(),
  text: zod.string(),
  providerMetadata: providerMetadataSchema.optional(),
});

// === SOURCE PART ===
// Extends base source schemas with streaming-specific fields (type discriminator, providerMetadata)

export type SourcePart = zod.infer<typeof sourcePartSchema>;

const urlSourcePartSchema = baseUrlSourceSchema.extend({
  type: zod.literal('source'),
  providerMetadata: providerMetadataSchema.optional(),
});

const documentSourcePartSchema = baseDocumentSourceSchema.extend({
  type: zod.literal('source'),
  providerMetadata: providerMetadataSchema.optional(),
});

export const sourcePartSchema = zod.union([
  urlSourcePartSchema,
  documentSourcePartSchema,
]);

// === FILE PART ===

export type FilePart = zod.infer<typeof filePartSchema>;
export const filePartSchema = zod.strictObject({
  type: zod.literal('file'),
  file: generatedFileSchema,
  providerMetadata: providerMetadataSchema.optional(),
});
