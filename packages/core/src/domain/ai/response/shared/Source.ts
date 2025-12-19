import zod from 'zod';
import { providerMetadataSchema } from './ProviderMetadata';

export type Source = zod.infer<typeof sourceSchema>;

export const sourceSchema = zod
  .strictObject({
    sourceType: zod.literal('url').describe('The type of source.'),
    id: zod.string().describe('The source identifier.'),
    url: zod.string().describe('The source URL.'),
    title: zod.string().optional().describe('The source title.'),
    providerMetadata: providerMetadataSchema.optional(),
  })
  .describe('A source used for generation (e.g., from web search or RAG).');
