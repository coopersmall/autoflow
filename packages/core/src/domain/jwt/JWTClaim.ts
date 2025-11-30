import type { Permission } from '@core/domain/permissions/permissions.ts';
import { permissionSchema } from '@core/domain/permissions/permissions.ts';
import { UserId, userIdSchema } from '@core/domain/user/user.ts';
import type { JWTPayload } from 'jose';
import zod from 'zod';

export type JWTClaim = Readonly<
  JWTPayload & {
    sub: string;
    aud: string[];
    iss: string;
    iat: number;
    exp?: number;
  }
>;

export const DEFAULT_EXPIRATION_TIME = 60 * 60 * 24;
export const SIGNATURE_ALGORITHM = 'RS256';

export const jwtClaimSchema = zod.object({
  sub: userIdSchema.describe('the user id (subject) of the JWT claim'),
  aud: zod
    .array(permissionSchema)
    .describe('the permissions (audience) of the JWT claim'),
  iss: zod.string().describe('the issuer of the JWT claim'),
  iat: zod.number().describe('the issued at timestamp of the JWT claim'),
  exp: zod
    .number()
    .optional()
    .describe('the expiration timestamp of the JWT claim'),
});

export function isValidJWTClaimStructure(claim: JWTPayload): claim is JWTClaim {
  return jwtClaimSchema.safeParse(claim).success;
}

export function getUserIdFromClaim(claim: JWTClaim): UserId {
  return UserId(claim.sub);
}

export function getPermissionsFromClaim(claim: JWTClaim): Permission[] {
  return claim.aud.filter(
    (p): p is Permission => permissionSchema.safeParse(p).success,
  );
}
