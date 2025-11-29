/**
 * HTTP server abstraction for managing server lifecycle.
 *
 * Provides a minimal interface for starting and stopping HTTP servers,
 * allowing different implementations (Bun, Node, etc.) through the
 * server client factory pattern.
 */

/**
 * Function type for gracefully stopping an HTTP server.
 * Returned by server start() method to enable clean shutdown.
 *
 * @returns Promise that resolves when server has stopped
 *
 * @example
 * ```ts
 * const { stop } = server.start({ port: 3000 });
 * // Later...
 * await stop();
 * ```
 */
export type StopFunction = () => Promise<void>;

/**
 * HTTP server interface for lifecycle management.
 *
 * Provides methods to start a server on a specified port and
 * optionally stop it gracefully. Implementations handle the
 * underlying server technology (Bun, Node, etc.).
 *
 * @example
 * ```ts
 * const server: IHttpServer = createServer({
 *   logger,
 *   routeHandlers: handlers
 * });
 *
 * const { stop } = server.start({ port: 3000 });
 * // Server is running...
 * await stop(); // Graceful shutdown
 * ```
 */
export interface IHttpServer {
  /**
   * Starts the HTTP server on the specified port.
   *
   * @param options - Server start options
   * @param options.port - Port number to listen on
   * @returns Object with optional stop function (undefined on error)
   */
  start(options: { port: number }): { stop?: StopFunction };
}
