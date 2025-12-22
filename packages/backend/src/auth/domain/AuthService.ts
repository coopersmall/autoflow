import type { Context } from '@backend/infrastructure/context';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import type { UserId } from '@core/domain/user/user';
import type { UsersSession } from '@core/domain/user-session/UsersSession';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export type IAuthService = Readonly<AuthService>;

interface AuthService {
  /**
   * Authenticates a user based on the provided authentication request type.
   */
  authenticate(
    ctx: Context,
    request: AuthenticationRequest,
  ): Promise<Result<UsersSession, AppError>>;

  /**
   * Creates a JWT claim structure from user ID and permissions.
   */
  createClaim(
    ctx: Context,
    request: {
      userId: UserId;
      permissions: Permission[];
      expirationTime?: number;
    },
  ): Result<JWTClaim, AppError>;

  /**
   * Validates a JWT claim structure, expiration, and required permissions.
   */
  validateClaim(
    ctx: Context,
    request: {
      claim: JWTClaim;
      requiredPermissions?: Permission[];
    },
  ): Result<JWTClaim, AppError>;

  /**
   * Extracts user ID from JWT claim subject field.
   */
  getUserId(claim: JWTClaim): Result<UserId, AppError>;

  /**
   * Extracts and validates permissions from JWT claim audience field.
   */
  getPermissions(claim: JWTClaim): Result<Permission[], AppError>;
}

export interface JWTAuthenticationRequest {
  type: 'jwt';
  token: string;
  publicKey: string;
  requiredPermissions?: Permission[];
}

export type AuthenticationRequest = JWTAuthenticationRequest;
