import {
  getPermissionsFromClaim,
  type JWTClaim,
} from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export function extractPermissions(
  claim: JWTClaim,
): Result<Permission[], ErrorWithMetadata> {
  try {
    const permissions = getPermissionsFromClaim(claim);
    return ok(permissions);
  } catch (cause) {
    return err(
      new ErrorWithMetadata(
        'Failed to extract permissions from JWT claim',
        'InternalServer',
        { claim, cause },
      ),
    );
  }
}
