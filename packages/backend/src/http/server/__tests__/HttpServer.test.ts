import { describe, expect, it, mock } from 'bun:test';
import type { IHttpHandler } from '@backend/http/domain/HttpHandler';
import { getMockedHttpServerClient } from '@backend/http/server/clients/__mocks__/HttpServerClient.mock';
import { getMockedHttpServerClientFactory } from '@backend/http/server/clients/__mocks__/HttpServerClientFactory.mock';
import { defaultWebSocketHandlers } from '@backend/http/server/domain/HttpWebSocketHandlers';
import { createHttpServerError } from '@backend/http/server/errors/HttpServerError';
import { createServer } from '@backend/http/server/HttpServer';
import { getMockedLogger } from '@backend/logger/__mocks__/Logger.mock';
import { err, ok } from 'neverthrow';

describe('HttpServer', () => {
  describe('createServer', () => {
    it('should create server instance', () => {
      const logger = getMockedLogger();
      const server = createServer({ logger });

      expect(server).toBeDefined();
      expect(typeof server.start).toBe('function');
    });

    it('should create server with route handlers', () => {
      const logger = getMockedLogger();
      const mockHandler = mock(() => new Response('OK'));
      const routeHandlers: IHttpHandler[] = [
        {
          routes: () => [
            {
              path: '/test',
              method: 'GET',
              handler: mockHandler,
            },
          ],
        },
      ];

      const server = createServer({ logger, routeHandlers });
      expect(server).toBeDefined();
    });

    it('should create server with websocket handlers', () => {
      const logger = getMockedLogger();
      const customWebSocket = {
        open: mock(() => {}),
        message: mock(() => {}),
        close: mock(() => {}),
      };

      const server = createServer({
        logger,
        webSocketHandlers: customWebSocket,
      });
      expect(server).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start server with factory', () => {
      const logger = getMockedLogger();
      const mockStopFn = mock(async () => {});
      const mockClient = getMockedHttpServerClient();
      mockClient.start = mock(() => mockStopFn);

      const mockFactory = getMockedHttpServerClientFactory();
      mockFactory.getServerClient = mock(() => ok(mockClient));

      const server = createServer(
        { logger },
        { serverClientFactory: mockFactory },
      );

      const result = server.start({ port: 3000 });

      expect(mockFactory.getServerClient).toHaveBeenCalledTimes(1);
      expect(mockFactory.getServerClient).toHaveBeenCalledWith('bun');
      expect(mockClient.start).toHaveBeenCalledTimes(1);
      expect(result.stop).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('Starting HTTP server', {
        port: 3000,
      });
      expect(logger.info).toHaveBeenCalledWith('HTTP server started', {
        port: 3000,
      });
    });

    it('should handle factory error', () => {
      const logger = getMockedLogger();
      const mockError = createHttpServerError(new Error('Factory failed'), {
        type: 'bun',
      });
      const mockFactory = getMockedHttpServerClientFactory();
      mockFactory.getServerClient = mock(() => err(mockError));

      const server = createServer(
        { logger },
        { serverClientFactory: mockFactory },
      );

      const result = server.start({ port: 3000 });

      expect(mockFactory.getServerClient).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(result.stop).toBeUndefined();
    });

    it('should handle client start error', () => {
      const logger = getMockedLogger();
      const mockClient = getMockedHttpServerClient();
      mockClient.start = mock(() => {
        throw new Error('Start failed');
      });

      const mockFactory = getMockedHttpServerClientFactory();
      mockFactory.getServerClient = mock(() => ok(mockClient));

      const server = createServer(
        { logger },
        { serverClientFactory: mockFactory },
      );

      const result = server.start({ port: 3000 });

      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(result.stop).toBeUndefined();
    });

    it('should return stop function that calls client stop', async () => {
      const logger = getMockedLogger();
      const mockStopFn = mock(async () => {});
      const mockClient = getMockedHttpServerClient();
      mockClient.start = mock(() => mockStopFn);

      const mockFactory = getMockedHttpServerClientFactory();
      mockFactory.getServerClient = mock(() => ok(mockClient));

      const server = createServer(
        { logger },
        { serverClientFactory: mockFactory },
      );

      const result = server.start({ port: 3000 });

      expect(result.stop).toBeDefined();
      await result.stop?.();
      expect(mockStopFn).toHaveBeenCalledTimes(1);
    });

    it('should pass routes to client', () => {
      const logger = getMockedLogger();
      const mockHandler = mock(() => new Response('OK'));
      const routeHandlers: IHttpHandler[] = [
        {
          routes: () => [
            {
              path: '/api/test',
              method: 'POST',
              handler: mockHandler,
            },
          ],
        },
      ];

      const mockClient = getMockedHttpServerClient();
      const mockFactory = getMockedHttpServerClientFactory();
      mockFactory.getServerClient = mock(() => ok(mockClient));

      const server = createServer(
        { logger, routeHandlers },
        { serverClientFactory: mockFactory },
      );

      server.start({ port: 8080 });

      expect(mockClient.start).toHaveBeenCalledTimes(1);
      const callArgs = mockClient.start.mock.calls[0];
      expect(callArgs[0].port).toBe(8080);
      expect(callArgs[0].routes['/api/test']).toBeDefined();
      expect(callArgs[0].routes['/api/test'].POST).toBe(mockHandler);
    });

    it('should pass websocket handlers to client', () => {
      const logger = getMockedLogger();
      const customWebSocket = {
        open: mock(() => {}),
        message: mock(() => {}),
        close: mock(() => {}),
      };

      const mockClient = getMockedHttpServerClient();
      const mockFactory = getMockedHttpServerClientFactory();
      mockFactory.getServerClient = mock(() => ok(mockClient));

      const server = createServer(
        { logger, webSocketHandlers: customWebSocket },
        { serverClientFactory: mockFactory },
      );

      server.start({ port: 3000 });

      expect(mockClient.start).toHaveBeenCalledTimes(1);
      const callArgs = mockClient.start.mock.calls[0];
      expect(callArgs[0].websocket).toBe(customWebSocket);
    });

    it('should use default websocket handlers when none provided', () => {
      const logger = getMockedLogger();
      const mockClient = getMockedHttpServerClient();
      const mockFactory = getMockedHttpServerClientFactory();
      mockFactory.getServerClient = mock(() => ok(mockClient));

      const server = createServer(
        { logger },
        { serverClientFactory: mockFactory },
      );

      server.start({ port: 3000 });

      expect(mockClient.start).toHaveBeenCalledTimes(1);
      const callArgs = mockClient.start.mock.calls[0];
      expect(callArgs[0].websocket).toBe(defaultWebSocketHandlers);
    });

    it('should allow multiple start/stop cycles', async () => {
      const logger = getMockedLogger();
      const mockStopFn1 = mock(async () => {});
      const mockStopFn2 = mock(async () => {});
      const mockClient = getMockedHttpServerClient();
      mockClient.start = mock(() => mockStopFn1)
        .mockImplementationOnce(() => mockStopFn1)
        .mockImplementationOnce(() => mockStopFn2);

      const mockFactory = getMockedHttpServerClientFactory();
      mockFactory.getServerClient = mock(() => ok(mockClient));

      const server = createServer(
        { logger },
        { serverClientFactory: mockFactory },
      );

      const result1 = server.start({ port: 3000 });
      await result1.stop?.();

      const result2 = server.start({ port: 3000 });
      await result2.stop?.();

      expect(mockClient.start).toHaveBeenCalledTimes(2);
      expect(mockStopFn1).toHaveBeenCalledTimes(1);
      expect(mockStopFn2).toHaveBeenCalledTimes(1);
    });
  });
});
