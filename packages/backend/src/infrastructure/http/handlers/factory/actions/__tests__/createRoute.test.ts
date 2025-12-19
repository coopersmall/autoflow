import { describe, expect, it, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { createContext } from '@backend/infrastructure/context';
import { getMockRequest } from '@backend/infrastructure/http/handlers/domain/__mocks__/Request.mock';
import { createRoute } from '@backend/infrastructure/http/handlers/factory/actions/createRoute';
import { getMockMiddleware } from '@backend/infrastructure/http/handlers/middleware/__mocks__/HttpMiddleware.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { CorrelationId } from '@core/domain/CorrelationId';
import { forbidden, unauthorized } from '@core/errors';
import { err, ok } from 'neverthrow';

describe('createRoute', () => {
  function createMockRequestContext() {
    const correlationId = CorrelationId('mock-correlation-id');
    const controller = new AbortController();
    const ctx = createContext(correlationId, controller);

    return {
      correlationId,
      signal: controller.signal,
      ctx,
      getParam: mock(),
      getSearchParam: mock(),
      getBody: mock(),
      getHeader: mock(),
    };
  }

  describe('Middleware configuration', () => {
    it('should execute api handler with middleware', async () => {
      const logger = getMockedLogger();
      const correlationId = CorrelationId('api-test-id');

      let handlerCalled = false;
      const mockHandler = mock(() => {
        handlerCalled = true;
        return new Response('API Success', { status: 200 });
      });

      const middleware = getMockMiddleware('success');
      const mockMiddlewareFactory = mock(() => [middleware]);
      const middlewareConfig = {
        api: [mockMiddlewareFactory],
        app: [],
        public: [],
      };
      const appConfig = getMockedAppConfigurationService();

      const mockRequest = getMockRequest({ url: 'http://localhost/api/users' });
      const mockRunMiddleware = mock(() => Promise.resolve(ok(mockRequest)));

      const httpRoute = createRoute(
        {
          logger,
          middlewareConfig,
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
          createRequestWithContext: mock(
            (correlationId, req) =>
              ({
                ...req,
                ctx: createContext(correlationId, new AbortController()),
              }) as any,
          ),
          buildRequestContext: mock(createMockRequestContext),
          createResponseFromError: mock(),
          extractCorrelationId: mock(() => correlationId),
          handleThrownError: mock(),
          runMiddleware: mockRunMiddleware,
        },
      );

      const response = await httpRoute.handler(mockRequest);

      expect(handlerCalled).toBe(true);
      expect(response.status).toBe(200);
      expect(mockMiddlewareFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredPermissions: ['read:users'],
        }),
      );
      expect(mockRunMiddleware).toHaveBeenCalledWith(
        { logger },
        {
          middlewares: [middleware],
          request: expect.any(Object),
        },
      );
    });
  });

  describe('Middleware error handling', () => {
    it('should return 401 when middleware returns Unauthorized error', async () => {
      const logger = getMockedLogger();
      const middlewareConfig = { api: [], app: [], public: [] };
      const appConfig = getMockedAppConfigurationService();

      const mockHandler = mock(() => {
        throw new Error('Should not be called');
      });

      const authError = unauthorized('Unauthorized');
      const mockRunMiddleware = mock(() => Promise.resolve(err(authError)));
      const mockCreateResponseFromError = mock(
        () => new Response('Unauthorized', { status: 401 }),
      );

      const httpRoute = createRoute(
        {
          logger,
          middlewareConfig,
          appConfig,
        },
        {
          path: '/api/test',
          method: 'GET',
          routeType: 'api',
          handler: mockHandler,
        },
        {
          createRequestWithContext: mock(
            (correlationId, req) =>
              ({
                ...req,
                ctx: createContext(correlationId, new AbortController()),
              }) as any,
          ),
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
      const middlewareConfig = { api: [], app: [], public: [] };
      const appConfig = getMockedAppConfigurationService();

      const mockHandler = mock(() => {
        throw new Error('Should not be called');
      });

      const forbiddenError = forbidden('Insufficient permissions');
      const mockRunMiddleware = mock(() =>
        Promise.resolve(err(forbiddenError)),
      );
      const mockCreateResponseFromError = mock(
        () => new Response('Forbidden', { status: 403 }),
      );

      const httpRoute = createRoute(
        {
          logger,
          middlewareConfig,
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
          createRequestWithContext: mock(
            (correlationId, req) =>
              ({
                ...req,
                ctx: createContext(correlationId, new AbortController()),
              }) as any,
          ),
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
  });
});
