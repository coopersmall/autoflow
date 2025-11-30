import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { Permission } from '@core/domain/permissions/permissions';
import type { UsersSession } from '@core/domain/session/UsersSession';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, type Result } from 'neverthrow';
import { authenticateFromJWT } from './authenticateFromJWT';

export interface JWTAuthenticationRequest {
  type: 'jwt';
  correlationId?: CorrelationId;
  token: string;
  publicKey: string;
  requiredPermissions?: Permission[];
}

export type AuthenticationRequest = JWTAuthenticationRequest;

export interface AuthenticateContext {
  logger: ILogger;
  encryption: () => IEncryptionService;
}

export async function authenticate(
  ctx: AuthenticateContext,
  request: AuthenticationRequest,
): Promise<Result<UsersSession, ErrorWithMetadata>> {
  switch (request.type) {
    case 'jwt':
      return authenticateFromJWT(ctx, {
        correlationId: request.correlationId,
        token: request.token,
        publicKey: request.publicKey,
        requiredPermissions: request.requiredPermissions,
      });

    default:
      return err(
        new ErrorWithMetadata(
          'Unsupported authentication type',
          'InternalServer',
          { type: request.type },
        ),
      );
  }
}
