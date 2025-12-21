import zod from 'zod';
import { providerMetadataSchema } from './ProviderMetadata';

export type Source = zod.infer<typeof sourceSchema>;

const urlSourceSchema = zod.strictObject({
  sourceType: zod.literal('url'),
  id: zod.string(),
  url: zod.string(),
  title: zod.string().optional(),
  providerMetadata: providerMetadataSchema.optional(),
});

const documentSourceSchema = zod.strictObject({
  sourceType: zod.literal('document'),
  id: zod.string(),
  mediaType: zod.string(),
  title: zod.string(),
  filename: zod.string().optional(),
  providerMetadata: providerMetadataSchema.optional(),
});

export const sourceSchema = zod
  .union([urlSourceSchema, documentSourceSchema])
  .describe('A source used for generation (e.g., from web search or RAG).');
