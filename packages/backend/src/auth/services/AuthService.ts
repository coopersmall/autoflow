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
import { createEncryptionService } from '@backend/infrastructure/encryption';
import type { IEncryptionService } from '@backend/infrastructure/encryption/domain/EncryptionService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { JWTClaim } from '@core/domain/jwt/JWTClaim';
import type { Permission } from '@core/domain/permissions/permissions';
import type { UsersSession } from '@core/domain/session/UsersSession';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export function createAuthService(ctx: AuthServiceContext): IAuthService {
  return Object.freeze(new AuthService(ctx));
}

interface AuthServiceContext {
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
    private readonly context: AuthServiceContext,
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
      logger: this.context.logger,
    });
  }

  /**
   * Authenticates a user based on the provided authentication request type.
   * Routes to specific authentication handlers (cookie, bearer, etc.) using discriminated union pattern.
   */
  async authenticate(
    request: AuthenticationRequest,
  ): Promise<Result<UsersSession, ErrorWithMetadata>> {
    return this.actions.authenticate(
      {
        logger: this.context.logger,
        encryption: () => this.encryption,
      },
      request,
    );
  }

  /**
   * Creates a JWT claim structure from user ID and permissions.
   * In local environment, grants all permissions and sets no expiration.
   * In production, uses provided permissions with expiration.
   */
  createClaim(
    request: CreateClaimRequest,
  ): Result<JWTClaim, ErrorWithMetadata> {
    return this.actions.createClaim(
      {
        logger: this.context.logger,
        appConfig: () => this.context.appConfig,
      },
      request,
    );
  }

  /**
   * Validates a JWT claim structure, expiration, and required permissions.
   */
  validateClaim(
    request: ValidateClaimRequest,
  ): Result<JWTClaim, ErrorWithMetadata> {
    return this.actions.validateClaim({ logger: this.context.logger }, request);
  }

  /**
   * Extracts user ID from JWT claim subject field.
   */
  getUserId(claim: JWTClaim): Result<UserId, ErrorWithMetadata> {
    return this.actions.extractUserId(claim);
  }

  /**
   * Extracts and validates permissions from JWT claim audience field.
   */
  getPermissions(claim: JWTClaim): Result<Permission[], ErrorWithMetadata> {
    return this.actions.extractPermissions(claim);
  }
}
