import type { ILogger } from '@backend/logger/Logger';
import type { IJWTService } from '@backend/services/jwt/JWTService';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { Permission } from '@core/domain/permissions/permissions';
import {
  createUserSession,
  type UsersSession,
} from '@core/domain/session/UsersSession';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface AuthenticateFromJWTRequest {
  correlationId?: CorrelationId;
  token: string;
  publicKey: string;
  requiredPermissions?: Permission[];
}

export async function authenticateFromJWT(
  ctx: {
    logger: ILogger;
    jwt: () => IJWTService;
  },
  {
    correlationId,
    token,
    publicKey,
    requiredPermissions,
  }: AuthenticateFromJWTRequest,
): Promise<Result<UsersSession, ErrorWithMetadata>> {
  const jwt = ctx.jwt();

  ctx.logger.debug('Authenticating from JWT token', {
    correlationId,
    hasPermissions: !!requiredPermissions?.length,
  });

  const claimResult = await jwt.decode({
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
  const validationResult = jwt.validate({
    correlationId,
    claim,
    requiredPermissions,
  });

  if (validationResult.isErr()) {
    ctx.logger.info('Authentication failed: validation failed', {
      correlationId,
      error: validationResult.error,
    });
    return err(validationResult.error);
  }

  const userIdResult = jwt.getUserId(claim);
  const permissionsResult = jwt.getPermissions(claim);

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
