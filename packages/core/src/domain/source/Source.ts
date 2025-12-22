import zod from 'zod';

/**
 * Base source types representing references used during AI generation.
 * These are provider-agnostic and used across the application.
 *
 * The AI layer extends these with provider-specific metadata (ProviderSource).
 * The conversation layer uses these directly.
 */

export const urlSourceSchema = zod.strictObject({
  sourceType: zod.literal('url'),
  id: zod.string(),
  url: zod.string(),
  title: zod.string().optional(),
});

export type UrlSource = zod.infer<typeof urlSourceSchema>;

export const documentSourceSchema = zod.strictObject({
  sourceType: zod.literal('document'),
  id: zod.string(),
  mediaType: zod.string(),
  title: zod.string().optional(),
  filename: zod.string().optional(),
});

export type DocumentSource = zod.infer<typeof documentSourceSchema>;

export const sourceSchema = zod
  .discriminatedUnion('sourceType', [urlSourceSchema, documentSourceSchema])
  .describe('A source used for generation (e.g., from web search or RAG).');

export type Source = zod.infer<typeof sourceSchema>;
