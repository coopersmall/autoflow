import { newId } from '@core/domain/Id';
import { createItemSchema } from '@core/domain/Item';
import {
  type Permission,
  permissionSchema,
} from '@core/domain/permissions/permissions';
import { type UserId, userIdSchema } from '@core/domain/user/user';
import zod from 'zod';

/**
 * Represents a user session.
 */
export type UsersSessionId = zod.infer<typeof usersSessionIdSchema>;
export const UsersSessionId = newId<UsersSessionId>;

const usersSessionIdSchema = zod
  .string()
  .brand<'UsersSession'>()
  .describe('the unique identifier for a user session');

export type UsersSession = Readonly<zod.infer<typeof usersSessionSchema>>;

const userSessionV1PartialSchema = zod.strictObject({
  userId: userIdSchema,
  permissions: zod.array(permissionSchema),
  schemaVersion: zod.literal(1),
});

const usersSessionV1Schema = createItemSchema(usersSessionIdSchema).merge(
  userSessionV1PartialSchema,
);

export const usersSessionPartialSchema = zod.discriminatedUnion(
  'schemaVersion',
  [userSessionV1PartialSchema],
);

export const usersSessionSchema = zod.discriminatedUnion('schemaVersion', [
  usersSessionV1Schema,
]);

export function createUserSession({
  userId,
  permissions,
}: {
  userId: UserId;
  permissions: Permission[];
}): UsersSession {
  return {
    id: UsersSessionId(),
    createdAt: new Date(),
    userId,
    permissions,
    schemaVersion: 1,
  };
}
