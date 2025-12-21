import { newId } from '@core/domain/Id';
import { createItemSchema } from '@core/domain/Item';
import { type UserId, userIdSchema } from '@core/domain/user/user';
import zod from 'zod';

export type IntegrationId = zod.infer<typeof integrationIdSchema>;
export const IntegrationId = newId<IntegrationId>;
export type IntegrationType = zod.infer<typeof integartionTypeSchema>;
export type IntegrationStatus = zod.infer<typeof integrationStatuses>;
export type IntegrationMetadata = Readonly<
  zod.infer<typeof integrationMetadataSchema>
>;

export const integrationIdSchema = zod
  .string()
  .brand<'IntegrationId'>()
  .describe('the id of an integration');

export const integartionTypeSchema = zod.enum([
  'ai-provider',
  'http',
  'polygon',
  'custom',
]);
export const integrationStatuses = zod.enum(['active', 'inactive']);

export const integrationMetadataSchema = zod.strictObject({
  createdBy: userIdSchema
    .optional()
    .describe('the user who created the integration'),
  lastEditedBy: userIdSchema
    .optional()
    .describe('the user who last edited the integration'),
  lastEditedAt: zod
    .date()
    .optional()
    .describe('the date when the integration was last edited'),
});

export const baseIntegrationSchema = createItemSchema(
  integrationIdSchema,
).extend({
  type: integartionTypeSchema.describe('the type of the integration'),
  status: integrationStatuses
    .default('active')
    .describe('the status of the integration'),
  metadata: integrationMetadataSchema.describe(
    'the metadata of the integration',
  ),
});

type BaseIntegration = zod.infer<typeof baseIntegrationSchema>;

export function newBaseIntegration({
  userId,
}: {
  userId?: UserId;
}): Omit<BaseIntegration, 'schemaVersion' | 'type'> {
  return {
    id: IntegrationId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'active',
    metadata: {
      createdBy: userId,
    },
  };
}
