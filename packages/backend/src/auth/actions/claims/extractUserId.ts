import { getUserIdFromClaim, type JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { UserId } from '@core/domain/user/user';
import { type AppError, internalError } from '@core/errors';
import { err, ok, type Result } from 'neverthrow';

export function extractUserId(claim: JWTClaim): Result<UserId, AppError> {
  if (!claim.sub) {
    return err(
      internalError('JWT claim is missing subject (sub) field', {
        metadata: { claim },
      }),
    );
  }
  try {
    const userId = getUserIdFromClaim(claim);
    return ok(userId);
  } catch (cause) {
    return err(
      internalError('Failed to extract user ID from JWT claim', {
        cause,
        metadata: { claim },
      }),
    );
  }
}
