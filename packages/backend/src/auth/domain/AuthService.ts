import type { CorrelationId } from '@core/domain/CorrelationId';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import type { UsersSession } from '@core/domain/session/UsersSession';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export type IAuthService = Readonly<AuthService>;

interface AuthService {
  /**
   * Authenticates a user based on the provided authentication request type.
   */
  authenticate(
    request: AuthenticationRequest,
  ): Promise<Result<UsersSession, ErrorWithMetadata>>;

  /**
   * Creates a JWT claim structure from user ID and permissions.
   */
  createClaim(request: {
    correlationId?: CorrelationId;
    userId: UserId;
    permissions: Permission[];
    expirationTime?: number;
  }): Result<JWTClaim, ErrorWithMetadata>;

  /**
   * Validates a JWT claim structure, expiration, and required permissions.
   */
  validateClaim(request: {
    correlationId?: CorrelationId;
    claim: JWTClaim;
    requiredPermissions?: Permission[];
  }): Result<JWTClaim, ErrorWithMetadata>;

  /**
   * Extracts user ID from JWT claim subject field.
   */
  getUserId(claim: JWTClaim): Result<UserId, ErrorWithMetadata>;

  /**
   * Extracts and validates permissions from JWT claim audience field.
   */
  getPermissions(claim: JWTClaim): Result<Permission[], ErrorWithMetadata>;
}

export interface JWTAuthenticationRequest {
  type: 'jwt';
  correlationId?: CorrelationId;
  token: string;
  publicKey: string;
  requiredPermissions?: Permission[];
}

export type AuthenticationRequest = JWTAuthenticationRequest;
