import {
  documentSourceSchema,
  urlSourceSchema,
} from '@core/domain/source/Source';
import zod from 'zod';
import { providerMetadataSchema } from './ProviderMetadata';

/**
 * Provider-aware source types that extend the base Source with provider metadata.
 * Used in AI SDK responses where provider-specific information may be attached.
 */

export const providerUrlSourceSchema = urlSourceSchema.extend({
  providerMetadata: providerMetadataSchema.optional(),
});

export type ProviderUrlSource = zod.infer<typeof providerUrlSourceSchema>;

export const providerDocumentSourceSchema = documentSourceSchema.extend({
  providerMetadata: providerMetadataSchema.optional(),
});

export type ProviderDocumentSource = zod.infer<
  typeof providerDocumentSourceSchema
>;

export const providerSourceSchema = zod
  .union([providerUrlSourceSchema, providerDocumentSourceSchema])
  .describe(
    'A source used for generation with optional provider metadata (e.g., from web search or RAG).',
  );

export type ProviderSource = zod.infer<typeof providerSourceSchema>;
