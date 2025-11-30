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
import type { IHttpHandler } from '@backend/infrastructure/http/domain/HttpHandler';
import type {
  IHttpServer,
  StopFunction,
} from '@backend/infrastructure/http/domain/HttpServer';
import {
  buildRouteHandlers,
  startServer,
} from '@backend/infrastructure/http/server/actions';
import { createHttpServerClientFactory } from '@backend/infrastructure/http/server/clients/HttpServerClientFactory';
import type { RouteHandlers } from '@backend/infrastructure/http/server/domain/HttpRouteHandlers';
import type {
  HttpServerClientType,
  IHttpServerClientFactory,
} from '@backend/infrastructure/http/server/domain/HttpServerClient';
import type { WebSocketHandlers } from '@backend/infrastructure/http/server/domain/HttpWebSocketHandlers';
import type { ILogger } from '@backend/infrastructure/logger/Logger';

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
  return Object.freeze(new Server(ctx, dependencies));
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
      this.httpRoutes = buildRouteHandlers({}, { handlers: ctx.routeHandlers });
    }
    if (ctx.webSocketHandlers) {
      this.webSocketConfig = ctx.webSocketHandlers;
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
    return startServer(
      {
        logger: this.ctx.logger,
        factory: this.factory,
        serverType: this.serverType,
      },
      {
        port,
        routes: this.httpRoutes,
        websocket: this.webSocketConfig,
      },
    );
  }
}
