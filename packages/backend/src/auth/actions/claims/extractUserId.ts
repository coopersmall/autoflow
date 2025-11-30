import { getUserIdFromClaim, type JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { UserId } from '@core/domain/user/user';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export function extractUserId(
  claim: JWTClaim,
): Result<UserId, ErrorWithMetadata> {
  try {
    const userId = getUserIdFromClaim(claim);
    return ok(userId);
  } catch (cause) {
    return err(
      new ErrorWithMetadata(
        'Failed to extract user ID from JWT claim',
        'InternalServer',
        {
          claim,
          cause,
        },
      ),
    );
  }
}
