import { baseIntegrationSchema } from '@core/domain/integrations/BaseIntegration';
import { secretIdSchema } from '@core/domain/secrets/Secret';
import zod from 'zod';

export type PolygonIntegration = Readonly<
  zod.infer<typeof polygonIntegrationSchema>
>;

const polygonIntegrationV1Schema = baseIntegrationSchema.extend({
  schemaVersion: zod.literal(1),
  name: zod.string().describe('the name of the Polygon integration'),
  apiKey: secretIdSchema.describe('the secret containing the Polygon API key'),
});

export const polygonIntegrationConfigSchema = zod.discriminatedUnion(
  'schemaVersion',
  [polygonIntegrationV1Schema],
);

export const polygonIntegrationSchema = baseIntegrationSchema.extend({
  type: zod.literal('polygon'),
  config: polygonIntegrationConfigSchema,
});

export function isPolygonIntegration(
  integration: unknown,
): integration is PolygonIntegration {
  return polygonIntegrationSchema.safeParse(integration).success;
}
