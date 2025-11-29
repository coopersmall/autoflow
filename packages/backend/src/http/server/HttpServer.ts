/**
 * HTTP server implementation with client factory pattern.
 *
 * Manages HTTP server lifecycle and route registration using the client factory
 * pattern for flexible server implementation (Bun, Node, etc.).
 *
 * Architecture:
 * - Uses factory pattern to create server clients
 * - Supports dependency injection for testing
 * - Manages route and websocket handler registration
 * - Provides graceful error handling and logging
 */
import type { IHttpHandler } from '@backend/http/domain/HttpHandler';
import type { IHttpRoute } from '@backend/http/domain/HttpRoute';
import type {
  IHttpServer,
  StopFunction,
} from '@backend/http/domain/HttpServer';
import { createHttpServerClientFactory } from '@backend/http/server/clients/HttpServerClientFactory';
import type { RouteHandlers } from '@backend/http/server/domain/HttpRouteHandlers';
import type {
  HttpServerClientType,
  IHttpServerClientFactory,
} from '@backend/http/server/domain/HttpServerClient';
import {
  defaultWebSocketHandlers,
  type WebSocketHandlers,
} from '@backend/http/server/domain/HttpWebSocketHandlers';
import { createHttpServerStartError } from '@backend/http/server/errors/HttpServerError';
import type { ILogger } from '@backend/logger/Logger';
import { isEmpty } from 'lodash';

/**
 * Factory function for creating HTTP server instances.
 * @param ctx - Server context (logger, handlers, websocket config)
 * @param dependencies - Optional dependencies (factory, server type)
 * @returns Configured HTTP server instance
 */
export function createServer(
  ctx: ServerContext,
  dependencies?: ServerDependencies,
): IHttpServer {
  return new Server(ctx, dependencies);
}

/**
 * Context required to create and configure an HTTP server.
 */
interface ServerContext {
  logger: ILogger;
  routeHandlers?: IHttpHandler[];
  webSocketHandlers?: WebSocketHandlers;
}

/**
 * Optional dependencies for server creation (used for testing and configuration).
 */
interface ServerDependencies {
  serverClientFactory?: IHttpServerClientFactory;
  serverType?: HttpServerClientType;
}

/**
 * Concrete implementation of HTTP server.
 * Manages server lifecycle, route registration, and delegates to server client.
 */
class Server implements IHttpServer {
  private httpRoutes: RouteHandlers = {};
  private webSocketConfig?: WebSocketHandlers;
  private readonly factory: IHttpServerClientFactory;
  private readonly serverType: HttpServerClientType;

  /**
   * Creates a new HTTP server instance.
   * @param ctx - Server context (logger, handlers, websocket)
   * @param dependencies - Optional dependencies (factory, server type)
   */
  constructor(
    private readonly ctx: ServerContext,
    dependencies?: ServerDependencies,
  ) {
    this.factory =
      dependencies?.serverClientFactory ?? createHttpServerClientFactory();
    this.serverType = dependencies?.serverType ?? 'bun';

    if (ctx.routeHandlers) {
      this.addHandlers(ctx.routeHandlers);
    }
    if (ctx.webSocketHandlers) {
      this.addWebSocketHandlers(ctx.webSocketHandlers);
    }
  }

  /**
   * Starts the HTTP server on the specified port.
   * Creates a server client via factory and delegates start operation.
   * @param options - Start options (port)
   * @returns Object with optional stop function (empty on error)
   */
  start({ port }: { port: number }): {
    stop?: StopFunction;
  } {
    const routes = this.httpRoutes;
    const websocket = this.webSocketConfig;

    const clientResult = this.factory.getServerClient(this.serverType);

    if (clientResult.isErr()) {
      this.ctx.logger.error(
        'Failed to create server client',
        clientResult.error,
        {
          port,
          serverType: this.serverType,
        },
      );
      return {};
    }

    const client = clientResult.value;

    try {
      this.ctx.logger.info('Starting HTTP server', { port });

      const config = {
        port,
        routes: routes && !isEmpty(routes) ? routes : {},
        websocket:
          websocket && !isEmpty(websocket)
            ? websocket
            : defaultWebSocketHandlers,
      };

      const stop = client.start(config);

      this.ctx.logger.info('HTTP server started', { port });
      return { stop };
    } catch (error) {
      this.ctx.logger.error(
        'Failed to start HTTP server',
        createHttpServerStartError(error, {
          port,
          serverType: this.serverType,
        }),
        {
          port,
          serverType: this.serverType,
          cause: error,
        },
      );
      return {};
    }
  }

  /**
   * Registers HTTP handlers and adds their routes to the server.
   * @param handler - Array of HTTP handlers to register
   */
  private addHandlers(handler: IHttpHandler[]) {
    for (const h of handler) {
      const routes = h.routes();
      for (const route of routes) {
        this.addRoute(route);
      }
    }
  }

  /**
   * Adds a single route to the server's route registry.
   * @param route - Route to register (path, method, handler)
   */
  private addRoute(route: IHttpRoute) {
    if (!this.httpRoutes[route.path]) {
      this.httpRoutes[route.path] = {};
    }
    this.httpRoutes[route.path][route.method] = route.handler;
  }

  /**
   * Configures WebSocket handlers for the server.
   * @param handlers - WebSocket event handlers (open, message, close)
   */
  private addWebSocketHandlers(handlers: WebSocketHandlers) {
    this.webSocketConfig = handlers;
  }
}
