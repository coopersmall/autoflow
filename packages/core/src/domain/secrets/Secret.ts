import { newId } from '@core/domain/Id';
import { createItemSchema } from '@core/domain/Item';
import { userIdSchema } from '@core/domain/user/user';
import zod from 'zod';

export type SecretId = zod.infer<typeof secretIdSchema>;
export const SecretId = newId<SecretId>;
export type SecretType = (typeof secretTypes)[number];
export type StoredSecret = Readonly<zod.infer<typeof storedSecretSchema>>;
export type Secret = Readonly<zod.infer<typeof secretSchema>>;
export type SecretWithValue = Readonly<Secret & { value: string }>;

export const secretIdSchema = zod
  .string()
  .brand<'SecretId'>()
  .describe('the id of a secret');

export const secretTypes = ['stored'] as const;
export const secretMetadataSchema = zod.strictObject({
  createdBy: userIdSchema
    .optional()
    .describe('the user who created the secret'),
  lastEditedBy: userIdSchema
    .optional()
    .describe('the user who last edited the secret'),
  lastEditedAt: zod
    .date()
    .optional()
    .describe('the date when the secret was last edited'),
});

const baseSecretSchema = createItemSchema(secretIdSchema).extend({
  type: zod.enum(secretTypes).describe('the type of the secret'),
  name: zod.string().min(1).describe('the name of the secret'),
  metadata: secretMetadataSchema.describe('the metadata of the secret'),
});

const storedSecretV1Schema = baseSecretSchema.extend({
  type: zod.literal('stored'),
  schemaVersion: zod.literal(1),
  salt: zod.string().min(1).describe('the salt used for hashing the secret'),
  encryptedValue: zod
    .string()
    .min(1)
    .describe('the encrypted value of the secret'),
});

export const storedSecretSchema = zod.discriminatedUnion('schemaVersion', [
  storedSecretV1Schema,
]);

export const secretSchema = zod.discriminatedUnion('type', [
  storedSecretV1Schema,
]);

export function isStoredSecret(secret: Secret): secret is StoredSecret {
  return secret.type === 'stored';
}
