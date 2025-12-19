/**
 * Authentication helper for HTTP integration tests.
 *
 * Provides utilities for generating JWT tokens with configurable permissions
 * to test various authentication and authorization scenarios. Uses the real
 * auth and encryption services (not mocks) to create valid tokens that will
 * be accepted by authentication middleware.
 *
 * Supports testing:
 * - 401 Unauthorized (no token, invalid token, expired token)
 * - 403 Forbidden (no permissions, insufficient permissions)
 * - 200 Success (valid token with correct permissions)
 *
 * Usage:
 * ```typescript
 * const auth = new TestAuth(config, authService);
 *
 * // Test with admin permissions
 * const adminHeaders = await auth.createAdminHeaders();
 * await client.post('/api/users', data, { headers: adminHeaders });
 *
 * // Test 403 Forbidden
 * const noPermToken = await auth.createUnauthorizedToken();
 * const headers = auth.createBearerHeaders(noPermToken);
 * await client.post('/api/users', data, { headers }); // 403
 * ```
 */

import type { IAuthService } from '@backend/auth/domain/AuthService';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { createContext } from '@backend/infrastructure/context';
import type { IEncryptionService } from '@backend/infrastructure/encryption';
import { CorrelationId } from '@core/domain/CorrelationId';
import type { Permission } from '@core/domain/permissions/permissions';
import { UserId } from '@core/domain/user/user';

/**
 * Options for creating a JWT token.
 */
export interface CreateTokenOptions {
  /**
   * User ID for the token subject.
   * Defaults to 'test-user-id'.
   */
  userId?: UserId;

  /**
   * Permissions to include in the token.
   * Defaults to ['admin'] for convenience.
   */
  permissions?: Permission[];

  /**
   * Token expiration time in seconds.
   * If not provided, uses default from auth service.
   * Use -1 to create an expired token.
   */
  expirationTime?: number;
}

/**
 * Test authentication helper for generating JWT tokens.
 *
 * @example
 * ```typescript
 * const auth = new TestAuth(config, authService);
 * const token = await auth.createAdminToken();
 * const headers = auth.createBearerHeaders(token);
 * ```
 */
export class TestAuth {
  /**
   * Creates a new test auth helper.
   *
   * @param config - App configuration service (provides JWT keys)
   * @param authService - Auth service for token generation
   */
  constructor(
    private readonly config: IAppConfigurationService,
    private readonly authService: IAuthService,
    private readonly encryptionService: IEncryptionService,
  ) {}

  /**
   * Creates a JWT token with specified options.
   *
   * This is the base method used by all convenience methods below.
   * Defaults to admin permissions if not specified.
   *
   * @param options - Token creation options
   * @returns JWT token string
   * @throws Error if token creation fails
   *
   * @example
   * ```typescript
   * const token = await auth.createToken({
   *   userId: UserId('user-123'),
   *   permissions: ['read:users', 'write:users']
   * });
   * ```
   */
  async createToken(options: CreateTokenOptions = {}): Promise<string> {
    const {
      userId = UserId('test-user-id'),
      permissions = ['admin'],
      expirationTime,
    } = options;

    const ctx = createContext(CorrelationId(), new AbortController());
    const tokenResult = this.authService.createClaim(ctx, {
      userId,
      permissions,
      expirationTime,
    });

    const token = tokenResult._unsafeUnwrap();

    const encodedTokenResult = await this.encryptionService.encodeJWT(ctx, {
      claim: token,
      privateKey: this.config.jwtPrivateKey!,
    });

    return encodedTokenResult._unsafeUnwrap();
  }

  /**
   * Creates a token with admin permissions.
   * Admin tokens have access to all endpoints.
   *
   * @param userId - Optional user ID (defaults to 'test-user-id')
   * @returns JWT token string
   *
   * @example
   * ```typescript
   * const token = await auth.createAdminToken();
   * ```
   */
  async createAdminToken(userId?: UserId): Promise<string> {
    return this.createToken({ userId, permissions: ['admin'] });
  }

  /**
   * Creates a token with NO permissions.
   * Use this to test 403 Forbidden responses.
   *
   * @param userId - Optional user ID (defaults to 'test-user-id')
   * @returns JWT token string
   *
   * @example
   * ```typescript
   * const token = await auth.createUnauthorizedToken();
   * const headers = auth.createBearerHeaders(token);
   * const response = await client.post('/api/users', data, { headers });
   * expect(response.status).toBe(403); // Forbidden
   * ```
   */
  async createUnauthorizedToken(userId?: UserId): Promise<string> {
    return this.createToken({ userId, permissions: [] });
  }

  /**
   * Creates a token with read:users permission only.
   * Use this to test read-only access scenarios.
   *
   * @param userId - Optional user ID (defaults to 'test-user-id')
   * @returns JWT token string
   *
   * @example
   * ```typescript
   * const token = await auth.createTokenWithReadAccess();
   * const headers = auth.createBearerHeaders(token);
   * // Can GET /api/users, but cannot POST
   * ```
   */
  async createTokenWithReadAccess(userId?: UserId): Promise<string> {
    return this.createToken({ userId, permissions: ['read:users'] });
  }

  /**
   * Creates a token with write:users permission only.
   * Use this to test write-only access scenarios.
   *
   * @param userId - Optional user ID (defaults to 'test-user-id')
   * @returns JWT token string
   *
   * @example
   * ```typescript
   * const token = await auth.createTokenWithWriteAccess();
   * ```
   */
  async createTokenWithWriteAccess(userId?: UserId): Promise<string> {
    return this.createToken({ userId, permissions: ['write:users'] });
  }

  /**
   * Creates an expired JWT token.
   * Use this to test 401 Unauthorized responses for expired tokens.
   *
   * @param userId - Optional user ID (defaults to 'test-user-id')
   * @returns JWT token string (expired)
   *
   * @example
   * ```typescript
   * const token = await auth.createExpiredToken();
   * const headers = auth.createBearerHeaders(token);
   * const response = await client.post('/api/users', data, { headers });
   * expect(response.status).toBe(401); // Unauthorized
   * ```
   */
  async createExpiredToken(userId?: UserId): Promise<string> {
    return this.createToken({
      userId,
      permissions: ['admin'],
      expirationTime: -3600, // Expired 1 hour ago (overcomes clock tolerance)
    });
  }

  /**
   * Creates Bearer authorization headers from a token.
   *
   * @param token - JWT token string
   * @returns Headers object with Authorization header
   *
   * @example
   * ```typescript
   * const token = await auth.createAdminToken();
   * const headers = auth.createBearerHeaders(token);
   * // headers = { 'Authorization': 'Bearer <token>', 'Content-Type': 'application/json' }
   * ```
   */
  createBearerHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Convenience method: creates admin token and returns Bearer headers.
   *
   * @param userId - Optional user ID (defaults to 'test-user-id')
   * @returns Headers object with admin Authorization header
   *
   * @example
   * ```typescript
   * const headers = await auth.createAdminHeaders();
   * const response = await client.post('/api/users', data, { headers });
   * ```
   */
  async createAdminHeaders(userId?: UserId): Promise<Record<string, string>> {
    const token = await this.createAdminToken(userId);
    return this.createBearerHeaders(token);
  }
}
