import zod from 'zod';
import { aiProviderIntegrationSchema } from './ai/providers/AiProviderIntegration.ts';
import { httpIntegrationSchema } from './http/HttpIntegration.ts';
import { polygonIntegrationSchema } from './polygon/PolygonIntegration.ts';

export * from './BaseIntegration.ts';
export type Integration = Readonly<zod.infer<typeof integrationSchema>>;

export const integrationSchema = zod.discriminatedUnion('type', [
  polygonIntegrationSchema,
  httpIntegrationSchema,
  aiProviderIntegrationSchema,
]);
