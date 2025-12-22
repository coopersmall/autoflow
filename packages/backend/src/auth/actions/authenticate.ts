import type { Context } from '@backend/infrastructure/context';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { Permission } from '@core/domain/permissions/permissions';
import type { UsersSession } from '@core/domain/user-session/UsersSession';
import { type AppError, internalError } from '@core/errors';
import { err, type Result } from 'neverthrow';
import { authenticateFromJWT } from './authenticateFromJWT';

export interface JWTAuthenticationRequest {
  type: 'jwt';
  token: string;
  publicKey: string;
  requiredPermissions?: Permission[];
}

export type AuthenticationRequest = JWTAuthenticationRequest;

export interface AuthenticateDeps {
  logger: ILogger;
  encryption: () => IEncryptionService;
}

export async function authenticate(
  ctx: Context,
  request: AuthenticationRequest,
  deps: AuthenticateDeps,
): Promise<Result<UsersSession, AppError>> {
  switch (request.type) {
    case 'jwt':
      return authenticateFromJWT(
        ctx,
        {
          token: request.token,
          publicKey: request.publicKey,
          requiredPermissions: request.requiredPermissions,
        },
        deps,
      );

    default:
      return err(
        internalError('Unsupported authentication type', {
          metadata: { type: request.type },
        }),
      );
  }
}
