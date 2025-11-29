import { describe, expect, it, mock } from 'bun:test';
import { getMockRequest } from '@backend/http/handlers/domain/__mocks__/Request.mock';
import { createRoute } from '@backend/http/handlers/factory/actions/createRoute';
import { getMockMiddleware } from '@backend/http/handlers/middleware/__mocks__/HttpMiddleware.mock';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { getMockedUserAuthenticationService } from '@backend/services/auth/__mocks__/UserAuthenticationService.mock';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok } from 'neverthrow';

describe('createRoute', () => {
  function createMockRequestContext() {
    return {
      correlationId: CorrelationId('mock-correlation-id'),
      getParam: mock(),
      getSearchParam: mock(),
      getBody: mock(),
      getHeader: mock(),
    };
  }

  describe('IHttpRoute creation', () => {
    it('should create IHttpRoute with correct path and method', () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();

      const mockHandler = mock(() => new Response('Success'));

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/api/test',
          method: 'GET',
          routeType: 'public',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(),
          extractCorrelationId: mock(() => CorrelationId()),
          handleThrownError: mock(),
          runMiddleware: mock(() => Promise.resolve(ok(getMockRequest()))),
        },
      );

      expect(httpRoute.path).toBe('/api/test');
      expect(httpRoute.method).toBe('GET');
      expect(httpRoute.handler).toBeFunction();
    });
  });

  describe('Public route execution', () => {
    it('should execute public handler without middleware', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();
      const correlationId = CorrelationId('test-id');

      let handlerCalled = false;
      const mockHandler = mock(() => {
        handlerCalled = true;
        return new Response('Success', { status: 200 });
      });

      const mockGetMiddleware = mock(() => []);
      const mockRequest = getMockRequest({
        url: 'http://localhost/public/test',
      });
      const mockBuildContext = mock(createMockRequestContext);
      const mockExtractCorrelationId = mock(() => correlationId);
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/public/test',
          method: 'GET',
          routeType: 'public',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: mockGetMiddleware,
          buildRequestContext: mockBuildContext,
          createResponseFromError: mock(),
          extractCorrelationId: mockExtractCorrelationId,
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      const response = await httpRoute.handler(mockRequest);

      expect(handlerCalled).toBe(true);
      expect(response.status).toBe(200);
      expect(mockGetMiddleware).toHaveBeenCalled();
    });
  });

  describe('API route execution', () => {
    it('should execute api handler with middleware', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();
      const correlationId = CorrelationId('api-test-id');

      let handlerCalled = false;
      const mockHandler = mock(() => {
        handlerCalled = true;
        return new Response('API Success', { status: 200 });
      });

      const middleware = getMockMiddleware('success');
      const mockGetMiddleware = mock(() => [middleware]);
      const mockRequest = getMockRequest({ url: 'http://localhost/api/users' });
      const mockBuildContext = mock(createMockRequestContext);
      const mockExtractCorrelationId = mock(() => correlationId);
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/api/users',
          method: 'GET',
          routeType: 'api',
          requiredPermissions: ['read:users'],
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: mockGetMiddleware,
          buildRequestContext: mockBuildContext,
          createResponseFromError: mock(),
          extractCorrelationId: mockExtractCorrelationId,
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      const response = await httpRoute.handler(mockRequest);

      expect(handlerCalled).toBe(true);
      expect(response.status).toBe(200);
      expect(mockGetMiddleware).toHaveBeenCalledWith(
        expect.objectContaining({ logger }),
        expect.objectContaining({
          routeType: 'api',
          requiredPermissions: ['read:users'],
        }),
      );
    });
  });

  describe('Middleware error handling', () => {
    it('should return 401 when middleware returns Unauthorized error', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();

      const mockHandler = mock(() => {
        throw new Error('Should not be called');
      });

      const authError = new ErrorWithMetadata('Unauthorized', 'Unauthorized');
      const mockRunMiddleware = mock(() => Promise.resolve(err(authError)));
      const mockCreateResponseFromError = mock(
        () => new Response('Unauthorized', { status: 401 }),
      );

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/api/test',
          method: 'GET',
          routeType: 'api',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mockCreateResponseFromError,
          extractCorrelationId: mock(() => CorrelationId()),
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      const mockRequest = getMockRequest({ url: 'http://localhost/api/test' });
      const response = await httpRoute.handler(mockRequest);

      expect(response.status).toBe(401);
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockCreateResponseFromError).toHaveBeenCalledWith(authError);
    });

    it('should return 403 when middleware returns Forbidden error', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();

      const mockHandler = mock(() => {
        throw new Error('Should not be called');
      });

      const forbiddenError = new ErrorWithMetadata(
        'Insufficient permissions',
        'Forbidden',
      );
      const mockRunMiddleware = mock(() =>
        Promise.resolve(err(forbiddenError)),
      );
      const mockCreateResponseFromError = mock(
        () => new Response('Forbidden', { status: 403 }),
      );

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/api/admin',
          method: 'POST',
          routeType: 'api',
          requiredPermissions: ['admin'],
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mockCreateResponseFromError,
          extractCorrelationId: mock(() => CorrelationId()),
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      const mockRequest = getMockRequest({ url: 'http://localhost/api/admin' });
      const response = await httpRoute.handler(mockRequest);

      expect(response.status).toBe(403);
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockCreateResponseFromError).toHaveBeenCalledWith(forbiddenError);
    });

    it('should log middleware errors', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();

      const mockHandler = mock(() => new Response('Success'));

      const middlewareError = new ErrorWithMetadata(
        'Auth failed',
        'Unauthorized',
      );
      const mockRunMiddleware = mock(() =>
        Promise.resolve(err(middlewareError)),
      );

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/api/test',
          method: 'GET',
          routeType: 'api',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(
            () => new Response('Error', { status: 401 }),
          ),
          extractCorrelationId: mock(() => CorrelationId()),
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      const mockRequest = getMockRequest({ url: 'http://localhost/api/test' });
      await httpRoute.handler(mockRequest);

      expect(logger.info).toHaveBeenCalledWith(
        'Middleware returned error',
        expect.objectContaining({
          error: 'Auth failed',
          code: 'Unauthorized',
        }),
      );
    });
  });

  describe('Request context building', () => {
    it('should build request context with correlation ID', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();
      const correlationId = CorrelationId('context-test-id');

      const mockHandler = mock(() => new Response('Success'));

      const mockRequest = getMockRequest({
        url: 'http://localhost/public/test',
      });
      const mockBuildContext = mock(createMockRequestContext);
      const mockExtractCorrelationId = mock(() => correlationId);
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/public/test',
          method: 'GET',
          routeType: 'public',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mockBuildContext,
          createResponseFromError: mock(),
          extractCorrelationId: mockExtractCorrelationId,
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      await httpRoute.handler(mockRequest);

      expect(mockExtractCorrelationId).toHaveBeenCalledWith(mockRequest);
      expect(mockBuildContext).toHaveBeenCalledWith({
        correlationId,
        request: mockRequest,
      });
    });
  });

  describe('Handler execution', () => {
    it('should execute async handler', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();

      const mockHandler = mock(
        async () => new Response('Async success', { status: 200 }),
      );

      const mockRequest = getMockRequest({
        url: 'http://localhost/public/test',
      });
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/public/test',
          method: 'GET',
          routeType: 'public',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(),
          extractCorrelationId: mock(() => CorrelationId()),
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      const response = await httpRoute.handler(mockRequest);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Async success');
    });

    it('should execute sync handler', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();

      const mockHandler = mock(
        () => new Response('Sync success', { status: 200 }),
      );

      const mockRequest = getMockRequest({
        url: 'http://localhost/public/test',
      });
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/public/test',
          method: 'GET',
          routeType: 'public',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(),
          extractCorrelationId: mock(() => CorrelationId()),
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      const response = await httpRoute.handler(mockRequest);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('Sync success');
    });
  });

  describe('Handler error handling', () => {
    it('should handle handler throwing error', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();
      const correlationId = CorrelationId('error-test-id');

      const mockHandler = mock(() => {
        throw new Error('Handler error');
      });

      const mockRequest = getMockRequest({
        url: 'http://localhost/public/test',
      });
      const mockExtractCorrelationId = mock(() => correlationId);
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));
      const mockHandleThrownError = mock(
        () => new Response('Error', { status: 500 }),
      );

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/public/test',
          method: 'GET',
          routeType: 'public',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(),
          extractCorrelationId: mockExtractCorrelationId,
          handleThrownError: mockHandleThrownError,
          runMiddleware: mockRunMiddleware,
        },
      );

      const response = await httpRoute.handler(mockRequest);

      expect(response.status).toBe(500);
      expect(mockHandleThrownError).toHaveBeenCalledWith(
        logger,
        correlationId,
        expect.any(Error),
        expect.any(Object),
      );
    });

    it('should handle handler throwing ErrorWithMetadata', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();
      const correlationId = CorrelationId('error-test-id');

      const handlerError = new ErrorWithMetadata('Bad request', 'BadRequest');
      const mockHandler = mock(() => {
        throw handlerError;
      });

      const mockRequest = getMockRequest({ url: 'http://localhost/api/test' });
      const mockExtractCorrelationId = mock(() => correlationId);
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));
      const mockHandleThrownError = mock(
        () => new Response('Bad request', { status: 400 }),
      );

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/api/test',
          method: 'POST',
          routeType: 'api',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(),
          extractCorrelationId: mockExtractCorrelationId,
          handleThrownError: mockHandleThrownError,
          runMiddleware: mockRunMiddleware,
        },
      );

      const response = await httpRoute.handler(mockRequest);

      expect(response.status).toBe(400);
      expect(mockHandleThrownError).toHaveBeenCalledWith(
        logger,
        correlationId,
        handlerError,
        expect.any(Object),
      );
    });
  });

  describe('Logging', () => {
    it('should log request processing with middleware count', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();

      const mockHandler = mock(() => new Response('Success'));

      const middleware1 = getMockMiddleware('success');
      const middleware2 = getMockMiddleware('success');
      const mockGetMiddleware = mock(() => [middleware1, middleware2]);

      const mockRequest = getMockRequest({ url: 'http://localhost/api/test' });
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/api/test',
          method: 'GET',
          routeType: 'api',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: mockGetMiddleware,
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(),
          extractCorrelationId: mock(() => CorrelationId()),
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      await httpRoute.handler(mockRequest);

      expect(logger.debug).toHaveBeenCalledWith(
        'Processing handler request',
        expect.objectContaining({
          routeType: 'api',
          url: 'http://localhost/api/test',
          middlewareCount: 2,
        }),
      );
    });

    it('should log handler execution with correlation ID', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();
      const correlationId = CorrelationId('log-test-id');

      const mockHandler = mock(() => new Response('Success'));

      const mockRequest = getMockRequest({
        url: 'http://localhost/public/test',
      });
      const mockExtractCorrelationId = mock(() => correlationId);
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/public/test',
          method: 'GET',
          routeType: 'public',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(),
          extractCorrelationId: mockExtractCorrelationId,
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      await httpRoute.handler(mockRequest);

      expect(logger.debug).toHaveBeenCalledWith(
        'Executing handler',
        expect.objectContaining({
          correlationId,
        }),
      );
    });

    it('should log handler completion with status', async () => {
      const logger = getMockedLogger();
      const userAuth = getMockedUserAuthenticationService();
      const appConfig = getMockedAppConfigurationService();
      const correlationId = CorrelationId('completion-test-id');

      const mockHandler = mock(() => new Response('Success', { status: 201 }));

      const mockRequest = getMockRequest({
        url: 'http://localhost/api/create',
      });
      const mockExtractCorrelationId = mock(() => correlationId);
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));

      const httpRoute = createRoute(
        {
          logger,
          userAuth,
          appConfig,
        },
        {
          path: '/api/create',
          method: 'POST',
          routeType: 'api',
          handler: mockHandler,
        },
        {
          getMiddlewareForHandler: () => [],
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(),
          extractCorrelationId: mockExtractCorrelationId,
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      await httpRoute.handler(mockRequest);

      expect(logger.debug).toHaveBeenCalledWith(
        'Handler completed successfully',
        expect.objectContaining({
          correlationId,
          status: 201,
        }),
      );
    });
  });
});
