import { describe, expect, it } from 'bun:test';
import { getMiddlewareForHandler } from '@backend/http/handlers/factory/actions/getMiddlewareForHandler';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { getMockedUserAuthenticationService } from '@backend/services/auth/__mocks__/UserAuthenticationService.mock';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';

describe('getMiddlewareForHandler', () => {
  it('should return empty array for public routes', () => {
    const logger = getMockedLogger();
    const userAuth = getMockedUserAuthenticationService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      userAuth,
      appConfig,
    };

    const middlewares = getMiddlewareForHandler(ctx, {
      routeType: 'public',
    });

    expect(middlewares).toEqual([]);
    expect(middlewares.length).toBe(0);
  });

  it('should return bearer token auth middleware for api routes', () => {
    const logger = getMockedLogger();
    const userAuth = getMockedUserAuthenticationService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      userAuth,
      appConfig,
    };

    const middlewares = getMiddlewareForHandler(ctx, {
      routeType: 'api',
    });

    expect(middlewares).toHaveLength(1);
    expect(middlewares[0]).toHaveProperty('handle');
    expect(typeof middlewares[0].handle).toBe('function');
  });

  it('should return cookie auth middleware for app routes', () => {
    const logger = getMockedLogger();
    const userAuth = getMockedUserAuthenticationService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      userAuth,
      appConfig,
    };

    const middlewares = getMiddlewareForHandler(ctx, {
      routeType: 'app',
    });

    expect(middlewares).toHaveLength(1);
    expect(middlewares[0]).toHaveProperty('handle');
    expect(typeof middlewares[0].handle).toBe('function');
  });

  it('should pass required permissions to api middleware', () => {
    const logger = getMockedLogger();
    const userAuth = getMockedUserAuthenticationService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      userAuth,
      appConfig,
    };

    const middlewares = getMiddlewareForHandler(ctx, {
      routeType: 'api',
      requiredPermissions: ['read:users', 'write:users'],
    });

    expect(middlewares).toHaveLength(1);
  });

  it('should pass required permissions to app middleware', () => {
    const logger = getMockedLogger();
    const userAuth = getMockedUserAuthenticationService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      userAuth,
      appConfig,
    };

    const middlewares = getMiddlewareForHandler(ctx, {
      routeType: 'app',
      requiredPermissions: ['admin'],
    });

    expect(middlewares).toHaveLength(1);
  });

  it('should handle api routes without permissions', () => {
    const logger = getMockedLogger();
    const userAuth = getMockedUserAuthenticationService();
    const appConfig = getMockedAppConfigurationService();

    const ctx = {
      logger,
      userAuth,
      appConfig,
    };

    const middlewares = getMiddlewareForHandler(ctx, {
      routeType: 'api',
    });

    expect(middlewares).toHaveLength(1);
  });
});
