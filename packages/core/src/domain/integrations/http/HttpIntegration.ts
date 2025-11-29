import { baseIntegrationSchema } from '@core/domain/integrations/BaseIntegration';
import { secretIdSchema } from '@core/domain/secrets/Secret';
import zod from 'zod';

export type HttpIntegration = zod.infer<typeof httpIntegrationSchema>;

const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;

const httpRequestSchema = zod.strictObject({
  name: zod.string().optional().describe('the name of the HTTP request'),
  description: zod
    .string()
    .optional()
    .describe('the description of the HTTP request'),
  url: zod.string().url().describe('the URL to send the HTTP request to'),
  body: zod.unknown().optional().describe('the body of the HTTP request'),
  method: zod
    .enum(httpMethods)
    .describe('the HTTP method to use for the request'),
  headers: zod
    .record(zod.string())
    .optional()
    .describe('the headers to include in the HTTP request'),
  secretHeaders: zod
    .record(secretIdSchema)
    .optional()
    .describe(
      'the secret headers to include in the HTTP request, where the value is a SecretId',
    ),
});

const httpIntegrationV1Schema = zod.strictObject({
  schemaVersion: zod.literal(1),
  requests: zod.array(httpRequestSchema).optional(),
});

export const httpIntegrationConfigSchema = zod.discriminatedUnion(
  'schemaVersion',
  [httpIntegrationV1Schema],
);

export const httpIntegrationSchema = baseIntegrationSchema.extend({
  type: zod.literal('http'),
  config: httpIntegrationConfigSchema,
});
