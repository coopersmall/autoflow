import type { StopFunction } from '@backend/infrastructure/http/domain/HttpServer';
import type { RouteHandlers } from '@backend/infrastructure/http/server/domain/HttpRouteHandlers';
import type {
  HttpServerClientType,
  IHttpServerClientFactory,
} from '@backend/infrastructure/http/server/domain/HttpServerClient';
import {
  defaultWebSocketHandlers,
  type WebSocketHandlers,
} from '@backend/infrastructure/http/server/domain/HttpWebSocketHandlers';
import { createHttpServerStartError } from '@backend/infrastructure/http/server/errors/HttpServerError';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { isEmpty } from 'lodash';

export type StartServerContext = {
  readonly logger: ILogger;
  readonly factory: IHttpServerClientFactory;
  readonly serverType: HttpServerClientType;
};

export type StartServerRequest = {
  readonly port: number;
  readonly routes: RouteHandlers;
  readonly websocket?: WebSocketHandlers;
};

/**
 * Starts the HTTP server with provided configuration.
 * Creates a server client via factory and delegates start operation.
 *
 * @param ctx - Context with logger, factory, and server type
 * @param request - Server configuration (port, routes, websocket)
 * @returns Object with optional stop function (empty on error)
 */
export function startServer(
  ctx: StartServerContext,
  request: StartServerRequest,
): { stop?: StopFunction } {
  const clientResult = ctx.factory.getServerClient(ctx.serverType);

  if (clientResult.isErr()) {
    ctx.logger.error('Failed to create server client', clientResult.error, {
      port: request.port,
      serverType: ctx.serverType,
    });
    return {};
  }

  const client = clientResult.value;

  try {
    ctx.logger.info('Starting HTTP server', { port: request.port });

    const config = {
      port: request.port,
      routes: request.routes && !isEmpty(request.routes) ? request.routes : {},
      websocket:
        request.websocket && !isEmpty(request.websocket)
          ? request.websocket
          : defaultWebSocketHandlers,
    };

    const stop = client.start(config);

    ctx.logger.info('HTTP server started', { port: request.port });
    return { stop };
  } catch (error) {
    ctx.logger.error(
      'Failed to start HTTP server',
      createHttpServerStartError(error, {
        port: request.port,
        serverType: ctx.serverType,
      }),
      {
        port: request.port,
        serverType: ctx.serverType,
        cause: error,
      },
    );
    return {};
  }
}
