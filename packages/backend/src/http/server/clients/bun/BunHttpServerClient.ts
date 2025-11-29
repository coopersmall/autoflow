/**
 * Bun HTTP server client implementation.
 *
 * Wraps Bun's native HTTP server functionality to provide a consistent interface
 * for the server layer. Handles server lifecycle (start/stop) and configuration.
 *
 * Architecture:
 * - Wraps Bun.serve() for server instantiation
 * - Manages server lifecycle (start returns stop function)
 * - Provides dependency injection for testing
 * - Type-safe configuration via ServerConfig
 */
import type { StopFunction } from '@backend/http/domain/HttpServer';
import type {
  IHttpServerClient,
  ServerConfig,
} from '@backend/http/server/domain/HttpServerClient';
import { type Server, serve } from 'bun';

/**
 * Factory function for creating BunHttpServerClient instances.
 * @param dependencies - Optional Bun.serve dependency for testing
 * @returns Configured Bun HTTP server client
 */
export function createBunHttpServerClient(
  dependencies = { serve },
): IHttpServerClient {
  return new BunHttpServerClient(dependencies);
}

type ServeFn = typeof serve;

/**
 * Concrete implementation of HTTP server client for Bun runtime.
 * Wraps Bun.serve() to provide consistent server lifecycle management.
 */
class BunHttpServerClient implements IHttpServerClient {
  /**
   * Creates a new Bun HTTP server client.
   * @param dependencies - Dependencies for server creation (Bun.serve)
   */
  constructor(private readonly dependencies: { serve: ServeFn }) {}

  /**
   * Starts the HTTP server using Bun.serve().
   * @param config - Server configuration (port, routes, websocket)
   * @returns Stop function to gracefully shutdown the server
   */
  start(config: ServerConfig): StopFunction {
    const serverInstance: Server<unknown> = this.dependencies.serve({
      port: config.port,
      routes: config.routes,
      websocket: config.websocket,
    });

    return async () => {
      return await serverInstance.stop();
    };
  }
}
