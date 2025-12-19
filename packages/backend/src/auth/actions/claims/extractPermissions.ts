import {
  getPermissionsFromClaim,
  type JWTClaim,
} from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import { type AppError, internalError } from '@core/errors';
import { err, ok, type Result } from 'neverthrow';

export function extractPermissions(
  claim: JWTClaim,
): Result<Permission[], AppError> {
  try {
    const permissions = getPermissionsFromClaim(claim);
    return ok(permissions);
  } catch (cause) {
    return err(
      internalError('Failed to extract permissions from JWT claim', {
        cause,
        metadata: { claim },
      }),
    );
  }
}
