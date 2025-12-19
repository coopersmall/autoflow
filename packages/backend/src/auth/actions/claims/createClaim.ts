import { validate } from '@autoflow/core';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import {
  DEFAULT_EXPIRATION_TIME,
  type JWTClaim,
} from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import {
  permissions as allPermissions,
  permissionSchema,
} from '@core/domain/permissions/permissions';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';

export interface CreateClaimRequest {
  userId: UserId;
  permissions: Permission[];
  expirationTime?: number;
}

export interface CreateClaimDeps {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}

export function createClaim(
  ctx: Context,
  {
    userId,
    permissions,
    expirationTime = DEFAULT_EXPIRATION_TIME,
  }: CreateClaimRequest,
  deps: CreateClaimDeps,
): Result<JWTClaim, AppError> {
  const validation = validate(permissionSchema.array(), permissions);
  if (validation.isErr()) {
    return err(validation.error);
  }

  const appConfig = deps.appConfig;
  const local = appConfig.isLocal();
  const sub = userId;
  const aud = local ? [...allPermissions] : permissions;
  const iss = appConfig.site;
  const iat = Math.floor(Date.now() / 1000);

  // Set expiration:
  // - In local mode: no expiration (undefined) for convenience
  // - In all other modes (test, production, etc): always expire using expirationTime
  const exp = local ? undefined : iat + expirationTime;

  deps.logger.debug('Created JWT claim', {
    correlationId: ctx.correlationId,
    userId,
    permissions: aud,
    expiresAt: exp,
  });

  return ok({ sub, iss, iat, exp, aud });
}
