import zod from 'zod';

export type ProviderMetadata = zod.infer<typeof providerMetadataSchema>;

export const providerMetadataSchema = zod
  .record(zod.string(), zod.record(zod.string(), zod.unknown()))
  .describe('Provider-specific metadata. Outer key is provider name.');
