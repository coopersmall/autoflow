import { createItemSchema } from '@core/domain/Item.ts';
import zod from 'zod';

const apiTokenDataSchema = zod.object({
  encodedToken: zod.string().min(32).describe('The API token string'),
  expiresAt: zod
    .date()
    .optional()
    .describe('The expiration date of the API token'),
});

export const apiTokenIdSchema = zod
  .string()
  .brand<'APITokenID'>()
  .describe('the id of an API token');

export const apiTokenSchemaV1 = createItemSchema(apiTokenIdSchema).extend({
  schemaVersion: zod.literal(1),
  ...apiTokenDataSchema.shape,
});

export const apiTokenSchema = zod.discriminatedUnion('schemaVersion', [
  apiTokenSchemaV1,
]);

export type APITokenId = zod.infer<typeof apiTokenIdSchema>;
export type APIToken = Readonly<zod.infer<typeof apiTokenSchema>>;
