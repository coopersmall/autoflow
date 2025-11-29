import { newId } from '@core/domain/Id';
import { createItemSchema } from '@core/domain/Item';
import zod from 'zod';

export type UserId = zod.infer<typeof userIdSchema>;
export const UserId = newId<UserId>;
export type User = zod.infer<typeof userSchema>;

export const userIdSchema = zod
  .string()
  .brand<'UserId'>()
  .describe('the id of a user');

const baseUserSchema = createItemSchema(userIdSchema).extend({});

const userV1Schema = baseUserSchema.extend({
  schemaVersion: zod.literal(1),
});

const partialUserV1Schema = userV1Schema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

const updateUserV1Schema = userV1Schema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

export const partialUserSchema = zod.discriminatedUnion('schemaVersion', [
  partialUserV1Schema,
]);

export const updateUserSchema = zod.discriminatedUnion('schemaVersion', [
  updateUserV1Schema,
]);

export const userSchema = zod.discriminatedUnion('schemaVersion', [
  userV1Schema,
]);

export function newUser(overrides?: Partial<User>): User {
  return {
    ...overrides,
    id: UserId(),
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
  };
}
