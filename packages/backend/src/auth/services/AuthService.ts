import {
  type AuthenticationRequest,
  authenticate,
} from '@backend/auth/actions/authenticate';
import {
  type CreateClaimRequest,
  createClaim,
} from '@backend/auth/actions/claims/createClaim';
import { extractPermissions } from '@backend/auth/actions/claims/extractPermissions';
import { extractUserId } from '@backend/auth/actions/claims/extractUserId';
import {
  type ValidateClaimRequest,
  validateClaim,
} from '@backend/auth/actions/claims/validateClaim';
import type { IAuthService } from '@backend/auth/domain/AuthService';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import { createEncryptionService } from '@backend/infrastructure/encryption';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import type { UsersSession } from '@core/domain/session/UsersSession';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export function createAuthService(config: AuthServiceConfig): IAuthService {
  return Object.freeze(new AuthService(config));
}

interface AuthServiceConfig {
  logger: ILogger;
  appConfig: IAppConfigurationService;
}

interface AuthServiceActions {
  authenticate: typeof authenticate;
  createClaim: typeof createClaim;
  validateClaim: typeof validateClaim;
  extractUserId: typeof extractUserId;
  extractPermissions: typeof extractPermissions;
}

interface AuthServiceDependencies {
  createEncryptionService: typeof createEncryptionService;
}

/**
 * Service for authentication and authorization operations.
 * Handles JWT claim creation, validation, and user authentication.
 */
class AuthService implements IAuthService {
  private readonly encryption: IEncryptionService;
  constructor(
    private readonly config: AuthServiceConfig,
    private readonly actions: AuthServiceActions = {
      authenticate,
      createClaim,
      validateClaim,
      extractUserId,
      extractPermissions,
    },
    dependencies: AuthServiceDependencies = {
      createEncryptionService,
    },
  ) {
    this.encryption = dependencies.createEncryptionService({
      logger: this.config.logger,
    });
  }

  /**
   * Authenticates a user based on the provided authentication request type.
   * Routes to specific authentication handlers (cookie, bearer, etc.) using discriminated union pattern.
   */
  async authenticate(
    ctx: Context,
    request: AuthenticationRequest,
  ): Promise<Result<UsersSession, AppError>> {
    return this.actions.authenticate(ctx, request, {
      logger: this.config.logger,
      encryption: () => this.encryption,
    });
  }

  /**
   * Creates a JWT claim structure from user ID and permissions.
   * In local environment, grants all permissions and sets no expiration.
   * In production, uses provided permissions with expiration.
   */
  createClaim(
    ctx: Context,
    request: CreateClaimRequest,
  ): Result<JWTClaim, AppError> {
    return this.actions.createClaim(ctx, request, {
      logger: this.config.logger,
      appConfig: this.config.appConfig,
    });
  }

  /**
   * Validates a JWT claim structure, expiration, and required permissions.
   */
  validateClaim(
    ctx: Context,
    request: ValidateClaimRequest,
  ): Result<JWTClaim, AppError> {
    return this.actions.validateClaim(ctx, request, {
      logger: this.config.logger,
    });
  }

  /**
   * Extracts user ID from JWT claim subject field.
   */
  getUserId(claim: JWTClaim): Result<UserId, AppError> {
    return this.actions.extractUserId(claim);
  }

  /**
   * Extracts and validates permissions from JWT claim audience field.
   */
  getPermissions(claim: JWTClaim): Result<Permission[], AppError> {
    return this.actions.extractPermissions(claim);
  }
}
