import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import { type AppError, forbidden, unauthorized } from '@core/errors';
import { err, ok, type Result } from 'neverthrow';

export interface ValidateClaimRequest {
  claim: JWTClaim;
  requiredPermissions?: Permission[];
}

export interface ValidateClaimDeps {
  logger: ILogger;
}

export function validateClaim(
  ctx: Context,
  { claim, requiredPermissions }: ValidateClaimRequest,
  deps: ValidateClaimDeps,
): Result<JWTClaim, AppError> {
  const correlationId = ctx.correlationId;
  if (!claim.sub || typeof claim.sub !== 'string') {
    const error = unauthorized('JWT claim missing or invalid subject', {
      metadata: { correlationId, claim },
    });
    deps.logger.debug('Invalid JWT claim: missing subject', { correlationId });
    return err(error);
  }

  if (!claim.aud || !Array.isArray(claim.aud)) {
    const error = unauthorized('JWT claim missing or invalid audience', {
      metadata: { correlationId, claim },
    });
    deps.logger.debug('Invalid JWT claim: missing audience', { correlationId });
    return err(error);
  }

  if (
    requiredPermissions &&
    requiredPermissions.length > 0 &&
    !requiredPermissions.some((permission) =>
      (claim.aud ?? []).includes(permission),
    )
  ) {
    const error = forbidden('JWT claim missing required permissions', {
      metadata: { correlationId, claim, requiredPermissions },
    });
    deps.logger.debug('Invalid JWT claim: insufficient permissions', {
      correlationId,
      requiredPermissions,
      actualPermissions: claim.aud,
    });
    return err(error);
  }

  if (claim.exp && Math.floor(Date.now() / 1000) > claim.exp) {
    const error = unauthorized('JWT claim has expired', {
      metadata: { correlationId, claim },
    });
    deps.logger.debug('Invalid JWT claim: expired', {
      correlationId,
      exp: claim.exp,
      now: Math.floor(Date.now() / 1000),
    });
    return err(error);
  }

  deps.logger.debug('Validated JWT claim', { correlationId });
  return ok(claim);
}
