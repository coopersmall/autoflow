import { describe, expect, it } from 'bun:test';
import { getMockedAuthService } from '@backend/auth/__mocks__/AuthService.mock';
import { createBearerTokenAuthenticationMiddleware } from '@backend/auth/middleware/createBearerTokenAuthenticationMiddleware';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockRequest } from '@backend/infrastructure/http/handlers/domain/__mocks__/Request.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import {
  type UsersSession,
  UsersSessionId,
} from '@core/domain/session/UsersSession';
import { UserId } from '@core/domain/user/user';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok } from 'neverthrow';

describe('createBearerTokenAuthenticationMiddleware', () => {
  const createMockSession = (): UsersSession => ({
    schemaVersion: 1,
    id: UsersSessionId(),
    createdAt: new Date(),
    userId: UserId('test-user'),
    permissions: ['read:users'],
  });

  it('should authenticate successfully with valid bearer token', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockSession = createMockSession();
    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer valid.jwt.token' }),
      context: { correlationId: CorrelationId('existing-id') },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {
      requiredPermissions: ['read:users'],
    });

    const result = await middleware.handle(mockRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.context?.userSession).toEqual(mockSession);
      expect(String(result.value.context?.correlationId)).toBe('existing-id');
    }
  });

  it('should add session to request context', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockSession = createMockSession();
    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer token123' }),
      context: {},
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.context?.userSession).toEqual(mockSession);
    }
  });

  it('should preserve correlation ID from request.context', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const existingCorrelationId = CorrelationId('existing-correlation-id');
    const mockSession = createMockSession();
    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer token123' }),
      context: { correlationId: existingCorrelationId },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.context?.correlationId).toBe(existingCorrelationId);
    }
  });

  it('should generate correlation ID if missing from request.context', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockSession = createMockSession();
    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer token123' }),
      context: {},
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.context?.correlationId).toBeDefined();
    }
  });

  it('should return Unauthorized error when no Authorization header', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockRequest = getMockRequest({
      context: { correlationId: CorrelationId('test-id') },
    });

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('Unauthorized');
      expect(result.error.message).toBe('No Authorization header found');
    }
  });

  it('should return Unauthorized error when Authorization header does not start with Bearer', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Basic dXNlcjpwYXNz' }),
      context: { correlationId: CorrelationId('test-id') },
    });

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('Unauthorized');
      expect(result.error.message).toBe(
        'Invalid Authorization header format. Expected: Bearer <token>',
      );
    }
  });

  it('should return Unauthorized error when token is empty after Bearer prefix', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer' }),
      context: { correlationId: CorrelationId('test-id') },
    });

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('Unauthorized');
      expect(result.error.message).toBe(
        'Invalid Authorization header format. Expected: Bearer <token>',
      );
    }
  });

  it('should return error when authentication fails', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const authError = new ErrorWithMetadata(
      'Invalid token',
      'Unauthorized',
      {},
    );
    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer invalid-token' }),
      context: { correlationId: CorrelationId('test-id') },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(err(authError)));

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBe(authError);
    }
  });

  it('should pass required permissions to auth', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockSession = createMockSession();
    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer token123' }),
      context: { correlationId: CorrelationId('test-id') },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {
      requiredPermissions: ['admin', 'write:users'],
    });

    await middleware.handle(mockRequest);

    expect(auth.authenticate).toHaveBeenCalledWith({
      type: 'jwt',
      token: 'token123',
      publicKey: appConfig.jwtPublicKey,
      correlationId: 'test-id',
      requiredPermissions: ['admin', 'write:users'],
    });
  });

  it('should log authentication attempts with correlationId', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockSession = createMockSession();
    const correlationId = CorrelationId('test-correlation-id');
    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer token123' }),
      context: { correlationId },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    await middleware.handle(mockRequest);

    expect(logger.debug).toHaveBeenCalledWith(
      'Bearer token authentication middleware executing',
      expect.objectContaining({
        correlationId,
      }),
    );
  });

  it('should log authentication success with userId', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockSession = createMockSession();
    const correlationId = CorrelationId('test-id');
    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer token123' }),
      context: { correlationId },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    await middleware.handle(mockRequest);

    expect(logger.debug).toHaveBeenCalledWith(
      'Bearer token authentication successful',
      expect.objectContaining({
        correlationId,
        userId: mockSession.userId,
      }),
    );
  });

  it('should log authentication failures', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const authError = new ErrorWithMetadata(
      'Invalid credentials',
      'Unauthorized',
      {},
    );
    const correlationId = CorrelationId('test-id');
    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer bad-token' }),
      context: { correlationId },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(err(authError)));

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    await middleware.handle(mockRequest);

    expect(logger.info).toHaveBeenCalledWith(
      'Bearer token authentication failed',
      expect.objectContaining({
        correlationId,
        error: 'Invalid credentials',
      }),
    );
  });

  it('should return InternalServer error when JWT public key not configured', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    appConfig.jwtPublicKey = undefined;

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockRequest = getMockRequest({
      headers: new Headers({ Authorization: 'Bearer token123' }),
      context: { correlationId: CorrelationId('test-id') },
    });

    const middleware = createBearerTokenAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.message).toBe('JWT public key not configured');
    }
  });
});
