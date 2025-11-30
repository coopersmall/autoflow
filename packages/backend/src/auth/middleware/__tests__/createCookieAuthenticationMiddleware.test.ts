import { describe, expect, it } from 'bun:test';
import { getMockedAuthService } from '@backend/auth/__mocks__/AuthService.mock';
import { createCookieAuthenticationMiddleware } from '@backend/auth/middleware/createCookieAuthenticationMiddleware';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockCookieMap } from '@backend/infrastructure/http/handlers/domain/__mocks__/Cookies.mock';
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

describe('createCookieAuthenticationMiddleware', () => {
  const createMockSession = (): UsersSession => ({
    schemaVersion: 1,
    id: UsersSessionId(),
    createdAt: new Date(),
    userId: UserId('test-user'),
    permissions: ['read:users'],
  });

  it('should authenticate successfully with valid cookies', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockSession = createMockSession();
    const mockCookies = getMockCookieMap([['auth', 'token123']]);
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: { correlationId: CorrelationId('existing-id') },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createCookieAuthenticationMiddleware(ctx, {
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
    const mockCookies = getMockCookieMap([['auth', 'token123']]);
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: {},
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

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
    const mockCookies = getMockCookieMap([['auth', 'token123']]);
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: { correlationId: existingCorrelationId },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

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
    const mockCookies = getMockCookieMap([['auth', 'token123']]);
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: {},
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.context?.correlationId).toBeDefined();
    }
  });

  it('should return Unauthorized error when no cookies', async () => {
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

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('Unauthorized');
      expect(result.error.message).toBe('Authentication required');
    }
  });

  it('should return Unauthorized error when no auth cookie', async () => {
    const logger = getMockedLogger();
    const auth = getMockedAuthService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      auth,
      appConfig,
    };

    const mockCookies = getMockCookieMap([['other', 'value']]);
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: { correlationId: CorrelationId('test-id') },
    });

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('Unauthorized');
      expect(result.error.message).toBe('No auth cookie found');
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
    const mockCookies = getMockCookieMap([['auth', 'invalid-token']]);
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: { correlationId: CorrelationId('test-id') },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(err(authError)));

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

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
    const mockCookies = getMockCookieMap([['auth', 'token123']]);
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: { correlationId: CorrelationId('test-id') },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createCookieAuthenticationMiddleware(ctx, {
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
    const mockCookies = getMockCookieMap([['auth', 'token123']]);
    const correlationId = CorrelationId('test-correlation-id');
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: { correlationId },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

    await middleware.handle(mockRequest);

    expect(logger.debug).toHaveBeenCalledWith(
      'Cookie authentication middleware executing',
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
    const mockCookies = getMockCookieMap([['auth', 'token123']]);
    const correlationId = CorrelationId('test-id');
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: { correlationId },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(ok(mockSession)));

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

    await middleware.handle(mockRequest);

    expect(logger.debug).toHaveBeenCalledWith(
      'Authentication successful',
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
    const mockCookies = getMockCookieMap([['auth', 'bad-token']]);
    const correlationId = CorrelationId('test-id');
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: { correlationId },
    });

    auth.authenticate.mockReturnValue(Promise.resolve(err(authError)));

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

    await middleware.handle(mockRequest);

    expect(logger.info).toHaveBeenCalledWith(
      'Authentication failed',
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

    const mockCookies = getMockCookieMap([['auth', 'token123']]);
    const mockRequest = getMockRequest({
      cookies: mockCookies,
      context: { correlationId: CorrelationId('test-id') },
    });

    const middleware = createCookieAuthenticationMiddleware(ctx, {});

    const result = await middleware.handle(mockRequest);

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.code).toBe('InternalServer');
      expect(result.error.message).toBe('JWT public key not configured');
    }
  });
});
