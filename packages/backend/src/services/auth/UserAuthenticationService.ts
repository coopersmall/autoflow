import type { ILogger } from '@backend/logger/Logger';
import type { IJWTService } from '@backend/services/jwt/JWTService';
import type { UsersSession } from '@core/domain/session/UsersSession';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';
import {
  type AuthenticationRequest,
  authenticate,
} from './actions/authenticate';

export type IUserAuthenticationService =
  ExtractMethods<UserAuthenticationService>;

export function createUserAuthenticationService(
  ctx: UserAuthenticationServiceContext,
): IUserAuthenticationService {
  return new UserAuthenticationService(ctx);
}

export interface UserAuthenticationServiceContext {
  logger: ILogger;
  jwt: () => IJWTService;
}

/**
 * Service for authenticating users via multiple authentication methods.
 * Supports cookie-based JWT authentication with extensibility for bearer tokens, API keys, and OAuth.
 * Routes authentication requests to appropriate handlers based on request type.
 */
export class UserAuthenticationService {
  constructor(
    private readonly context: UserAuthenticationServiceContext,
    private readonly actions = {
      authenticate,
    },
  ) {}

  /**
   * Authenticates a user based on the provided authentication request type.
   * Routes to specific authentication handlers (cookie, bearer, etc.) using discriminated union pattern.
   * @param request - Authentication request with discriminated type union
   * @param request.type - Authentication type ('cookie', 'bearer', etc.)
   * @param request.correlationId - Unique identifier for tracking this operation
   * @param request.requiredPermissions - Optional permissions that must be present
   * @returns Promise resolving to user session with ID and permissions or error details
   */
  async authenticate(
    request: AuthenticationRequest,
  ): Promise<Result<UsersSession, ErrorWithMetadata>> {
    return this.actions.authenticate(this.context, request);
  }
}
