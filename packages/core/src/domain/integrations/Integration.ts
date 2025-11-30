import zod from 'zod';
import { aiProviderIntegrationSchema } from './ai/providers/AiProviderIntegration';
import { httpIntegrationSchema } from './http/HttpIntegration';
import { polygonIntegrationSchema } from './polygon/PolygonIntegration';

export * from './BaseIntegration';
export type Integration = Readonly<zod.infer<typeof integrationSchema>>;

export const integrationSchema = zod.discriminatedUnion('type', [
  polygonIntegrationSchema,
  httpIntegrationSchema,
  aiProviderIntegrationSchema,
]);
