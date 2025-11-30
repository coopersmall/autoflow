import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import {
  DEFAULT_EXPIRATION_TIME,
  type JWTClaim,
} from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import { permissions as allPermissions } from '@core/domain/permissions/permissions';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { ok, type Result } from 'neverthrow';

export interface CreateClaimRequest {
  correlationId?: CorrelationId;
  userId: UserId;
  permissions: Permission[];
  expirationTime?: number;
}

export interface CreateClaimContext {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}

export function createClaim(
  ctx: CreateClaimContext,
  {
    correlationId,
    userId,
    permissions,
    expirationTime = DEFAULT_EXPIRATION_TIME,
  }: CreateClaimRequest,
): Result<JWTClaim, ErrorWithMetadata> {
  const appConfig = ctx.appConfig;
  const local = appConfig.isLocal();
  const sub = userId;
  const aud = local ? [...allPermissions] : permissions;
  const iss = appConfig.site;
  const iat = Math.floor(Date.now() / 1000);

  // Set expiration:
  // - In local mode: no expiration (undefined) for convenience
  // - In all other modes (test, production, etc): always expire using expirationTime
  const exp = local ? undefined : iat + expirationTime;

  ctx.logger.debug('Created JWT claim', {
    correlationId,
    userId,
    permissions: aud,
    expiresAt: exp,
  });

  return ok({ sub, iss, iat, exp, aud });
}
