import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface ValidateClaimRequest {
  correlationId?: CorrelationId;
  claim: JWTClaim;
  requiredPermissions?: Permission[];
}

export interface ValidateClaimContext {
  logger: ILogger;
}

export function validateClaim(
  ctx: ValidateClaimContext,
  { correlationId, claim, requiredPermissions }: ValidateClaimRequest,
): Result<JWTClaim, ErrorWithMetadata> {
  if (!claim.sub || typeof claim.sub !== 'string') {
    const error = new ErrorWithMetadata(
      'JWT claim missing or invalid subject',
      'Unauthorized',
      { correlationId, claim },
    );
    ctx.logger.debug('Invalid JWT claim: missing subject', { correlationId });
    return err(error);
  }

  if (!claim.aud || !Array.isArray(claim.aud)) {
    const error = new ErrorWithMetadata(
      'JWT claim missing or invalid audience',
      'Unauthorized',
      { correlationId, claim },
    );
    ctx.logger.debug('Invalid JWT claim: missing audience', { correlationId });
    return err(error);
  }

  if (
    requiredPermissions &&
    requiredPermissions.length > 0 &&
    !requiredPermissions.some((permission) =>
      (claim.aud ?? []).includes(permission),
    )
  ) {
    const error = new ErrorWithMetadata(
      'JWT claim missing required permissions',
      'Forbidden',
      { correlationId, claim, requiredPermissions },
    );
    ctx.logger.debug('Invalid JWT claim: insufficient permissions', {
      correlationId,
      requiredPermissions,
      actualPermissions: claim.aud,
    });
    return err(error);
  }

  if (claim.exp && Math.floor(Date.now() / 1000) > claim.exp) {
    const error = new ErrorWithMetadata(
      'JWT claim has expired',
      'Unauthorized',
      { correlationId, claim },
    );
    ctx.logger.debug('Invalid JWT claim: expired', {
      correlationId,
      exp: claim.exp,
      now: Math.floor(Date.now() / 1000),
    });
    return err(error);
  }

  ctx.logger.debug('Validated JWT claim', { correlationId });
  return ok(claim);
}
