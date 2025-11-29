import zod from 'zod';

export const permissions = ['admin', 'read:users', 'write:users'] as const;
export const permissionSchema = zod.enum(permissions);

export type Permission = zod.infer<typeof permissionSchema>;

export function hasPermissions(allowed: Permission[]): boolean {
  return allowed.some((permission) => permissions.includes(permission));
}
