import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { Permission } from '@core/domain/permissions/permissions';
import {
  createUserSession,
  type UsersSession,
} from '@core/domain/session/UsersSession';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';
import { extractPermissions } from './claims/extractPermissions';
import { extractUserId } from './claims/extractUserId';
import { validateClaim } from './claims/validateClaim';

export interface AuthenticateFromJWTRequest {
  correlationId?: CorrelationId;
  token: string;
  publicKey: string;
  requiredPermissions?: Permission[];
}

export interface AuthenticateFromJWTContext {
  logger: ILogger;
  encryption: () => IEncryptionService;
}

export async function authenticateFromJWT(
  ctx: AuthenticateFromJWTContext,
  {
    correlationId,
    token,
    publicKey,
    requiredPermissions,
  }: AuthenticateFromJWTRequest,
): Promise<Result<UsersSession, ErrorWithMetadata>> {
  const encryption = ctx.encryption();

  ctx.logger.debug('Authenticating from JWT token', {
    correlationId,
    hasPermissions: !!requiredPermissions?.length,
  });

  const claimResult = await encryption.decodeJWT({
    correlationId,
    token,
    publicKey,
  });

  if (claimResult.isErr()) {
    ctx.logger.info('Authentication failed: invalid JWT', {
      correlationId,
      error: claimResult.error,
    });
    return err(claimResult.error);
  }

  const claim = claimResult.value;
  const validationResult = validateClaim(
    { logger: ctx.logger },
    {
      correlationId,
      claim,
      requiredPermissions,
    },
  );

  if (validationResult.isErr()) {
    ctx.logger.info('Authentication failed: validation failed', {
      correlationId,
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

  ctx.logger.debug('User authenticated from JWT', {
    correlationId,
    userId: session.userId,
  });

  return ok(session);
}
