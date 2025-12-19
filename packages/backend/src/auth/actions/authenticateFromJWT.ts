import type { Context } from '@backend/infrastructure/context';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { Permission } from '@core/domain/permissions/permissions';
import {
  createUserSession,
  type UsersSession,
} from '@core/domain/session/UsersSession';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { extractPermissions } from './claims/extractPermissions.ts';
import { extractUserId } from './claims/extractUserId.ts';
import { validateClaim } from './claims/validateClaim.ts';

export interface AuthenticateFromJWTRequest {
  token: string;
  publicKey: string;
  requiredPermissions?: Permission[];
}

export interface AuthenticateFromJWTDeps {
  logger: ILogger;
  encryption: () => IEncryptionService;
}

export async function authenticateFromJWT(
  ctx: Context,
  { token, publicKey, requiredPermissions }: AuthenticateFromJWTRequest,
  deps: AuthenticateFromJWTDeps,
): Promise<Result<UsersSession, AppError>> {
  const encryption = deps.encryption();

  deps.logger.debug('Authenticating from JWT token', {
    correlationId: ctx.correlationId,
    hasPermissions: !!requiredPermissions?.length,
  });

  const claimResult = await encryption.decodeJWT(ctx, {
    token,
    publicKey,
  });

  if (claimResult.isErr()) {
    deps.logger.info('Authentication failed: invalid JWT', {
      correlationId: ctx.correlationId,
      error: claimResult.error,
    });
    return err(claimResult.error);
  }

  const claim = claimResult.value;
  const validationResult = validateClaim(
    ctx,
    {
      claim,
      requiredPermissions,
    },
    { logger: deps.logger },
  );

  if (validationResult.isErr()) {
    deps.logger.info('Authentication failed: validation failed', {
      correlationId: ctx.correlationId,
      error: validationResult.error,
    });
    return err(validationResult.error);
  }

  const userIdResult = extractUserId(claim);
  const permissionsResult = extractPermissions(claim);

  if (userIdResult.isErr()) {
    return err(userIdResult.error);
  }

  if (permissionsResult.isErr()) {
    return err(permissionsResult.error);
  }

  const session = createUserSession({
    userId: userIdResult.value,
    permissions: permissionsResult.value,
  });

  deps.logger.debug('User authenticated from JWT', {
    correlationId: ctx.correlationId,
    userId: session.userId,
  });

  return ok(session);
}
