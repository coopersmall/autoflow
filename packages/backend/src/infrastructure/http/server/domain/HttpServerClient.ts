/**
 * HTTP server client abstraction interfaces.
 *
 * Defines the contracts for server client factories and implementations used throughout
 * the HTTP server layer. These abstractions allow different server implementations
 * (e.g., Bun, Node, Express) to be swapped without changing server code.
 */
import type { StopFunction } from '@backend/infrastructure/http/domain/HttpServer';
import type { RouteHandlers } from '@backend/infrastructure/http/server/domain/HttpRouteHandlers';
import type { WebSocketHandlers } from '@backend/infrastructure/http/server/domain/HttpWebSocketHandlers';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import zod from 'zod';

/**
 * Supported HTTP server client types.
 * Currently supports Bun, with room for Node, Express, Fastify, etc.
 */
const httpServerClientTypes = zod.enum(['bun']);
export type HttpServerClientType = zod.infer<typeof httpServerClientTypes>;

/**
 * Configuration required to start an HTTP server.
 * Includes port, route handlers, and websocket configuration.
 */
export interface ServerConfig {
  port: number;
  routes: RouteHandlers;
  websocket: WebSocketHandlers;
}

/**
 * HTTP server client interface representing server lifecycle management.
 * Abstracts the underlying server implementation (Bun, Node, etc.).
 */
export interface IHttpServerClient {
  /**
   * Starts the HTTP server with the provided configuration.
   * @param config - Server configuration (port, routes, websocket)
   * @returns Stop function to gracefully shutdown the server
   */
  start(config: ServerConfig): StopFunction;
}

/**
 * Factory interface for creating HTTP server clients.
 * Supports multiple server implementations via type parameter.
 */
export interface IHttpServerClientFactory {
  /**
   * Creates an HTTP server client for the specified type.
   * @param type - Server client type ('bun', 'node', etc.)
   * @returns Server client or configuration error
   */
  getServerClient(
    type: HttpServerClientType,
  ): Result<IHttpServerClient, ErrorWithMetadata>;
}
