import { describe, expect, it, mock } from 'bun:test';
import type { StopFunction } from '@backend/http/domain/HttpServer';
import { createBunHttpServerClient } from '@backend/http/server/clients/bun/BunHttpServerClient';
import type { ServerConfig } from '@backend/http/server/domain/HttpServerClient';
import { defaultWebSocketHandlers } from '@backend/http/server/domain/HttpWebSocketHandlers';
import type { Server } from 'bun';

describe('BunHttpServerClient', () => {
  const createMockServer = (
    overrides: Partial<Server<unknown>> = {},
  ): Server<unknown> => ({
    stop: mock(),
    reload: mock(),
    fetch: mock(),
    upgrade: mock(),
    publish: mock(),
    subscriberCount: mock(),
    requestIP: mock(),
    timeout: mock(),
    ref: mock(),
    unref: mock(),
    pendingRequests: 0,
    pendingWebSockets: 0,
    url: new URL('http://localhost'),
    hostname: '',
    port: 0,
    development: true,
    id: '',
    [Symbol.dispose]() {},
    ...overrides,
  });

  const createMockServe = (serverInstance: Server<unknown>) =>
    mock((): Server<unknown> => serverInstance);

  describe('createBunHttpServerClient', () => {
    it('should create client with default dependencies', () => {
      const client = createBunHttpServerClient();
      expect(client).toBeDefined();
    });

    it('should create client with custom dependencies', () => {
      const mockServe = createMockServe(createMockServer());
      const client = createBunHttpServerClient({ serve: mockServe });
      expect(client).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start server with config', () => {
      const mockServer = createMockServer();
      const mockServe = createMockServe(mockServer);
      const client = createBunHttpServerClient({ serve: mockServe });

      const config: ServerConfig = {
        port: 3000,
        routes: {},
        websocket: defaultWebSocketHandlers,
      };

      const stop = client.start(config);

      expect(mockServe).toHaveBeenCalledTimes(1);
      expect(mockServe).toHaveBeenCalledWith({
        port: 3000,
        routes: {},
        websocket: defaultWebSocketHandlers,
      });
      expect(stop).toBeInstanceOf(Function);
    });

    it('should pass routes to serve', () => {
      const mockServer = createMockServer();
      const mockServe = createMockServe(mockServer);
      const client = createBunHttpServerClient({ serve: mockServe });

      const mockHandler = mock(() => new Response('OK'));
      const config: ServerConfig = {
        port: 8080,
        routes: {
          '/test': { GET: mockHandler },
        },
        websocket: defaultWebSocketHandlers,
      };

      client.start(config);

      expect(mockServe).toHaveBeenCalledWith({
        port: 8080,
        routes: { '/test': { GET: mockHandler } },
        websocket: defaultWebSocketHandlers,
      });
    });

    it('should pass websocket handlers to serve', () => {
      const mockServer = createMockServer();
      const mockServe = createMockServe(mockServer);
      const client = createBunHttpServerClient({ serve: mockServe });

      const customWebSocket = {
        open: mock(() => {}),
        message: mock(() => {}),
        close: mock(() => {}),
      };

      const config: ServerConfig = {
        port: 3000,
        routes: {},
        websocket: customWebSocket,
      };

      client.start(config);

      expect(mockServe).toHaveBeenCalledWith({
        port: 3000,
        routes: {},
        websocket: customWebSocket,
      });
    });

    it('should return stop function', () => {
      const mockServer = createMockServer();
      const mockServe = createMockServe(mockServer);
      const client = createBunHttpServerClient({ serve: mockServe });

      const config: ServerConfig = {
        port: 3000,
        routes: {},
        websocket: defaultWebSocketHandlers,
      };

      const stop: StopFunction = client.start(config);

      expect(typeof stop).toBe('function');
    });

    it('should call server.stop when stop function is called', async () => {
      const mockStopFn = mock();
      const mockServe = createMockServe(createMockServer({ stop: mockStopFn }));
      const client = createBunHttpServerClient({ serve: mockServe });

      const config: ServerConfig = {
        port: 3000,
        routes: {},
        websocket: defaultWebSocketHandlers,
      };

      const stop = client.start(config);
      await stop();

      expect(mockStopFn).toHaveBeenCalledTimes(1);
    });
  });
});
