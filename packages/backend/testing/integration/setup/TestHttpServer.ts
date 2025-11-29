/**
 * HTTP server wrapper for integration testing.
 *
 * Manages HTTP server lifecycle (start/stop) and validates server readiness
 * before tests run. Uses TCP port polling with exponential backoff to detect
 * when the server is accepting connections.
 *
 * Responsibilities:
 * - Start HTTP server with provided handlers
 * - Wait for server to be ready (TCP port check)
 * - Provide base URL for client construction
 * - Clean shutdown on test completion
 *
 * NOT responsible for:
 * - Making HTTP requests (use TestHttpClient)
 * - Managing authentication (use TestAuth)
 */
import type { IHttpHandler } from '@backend/http/domain/HttpHandler';
import type {
  IHttpServer,
  StopFunction,
} from '@backend/http/domain/HttpServer';
import { createServer } from '@backend/http/server/HttpServer';
import type { ILogger } from '@backend/logger/Logger';

/**
 * Test HTTP server for integration testing.
 *
 * @example
 * ```typescript
 * const server = new TestHttpServer(9000, logger);
 * await server.start([usersHandler, authHandler]);
 * // ... run tests ...
 * await server.stop();
 * ```
 */
export class TestHttpServer {
  private server?: IHttpServer;
  private stopFn?: StopFunction;
  private readonly baseUrl: string;

  /**
   * Creates a new test HTTP server.
   *
   * @param port - Port number to bind the server to
   * @param logger - Logger instance for server logging
   */
  constructor(
    private readonly port: number,
    private readonly logger: ILogger,
  ) {
    this.baseUrl = `http://localhost:${port}`;
  }

  /**
   * Starts the HTTP server with provided handlers and waits for readiness.
   *
   * This method:
   * 1. Creates the HTTP server with provided handlers
   * 2. Starts the server on the configured port
   * 3. Waits for the server to be ready (TCP port polling)
   * 4. Throws if server fails to start or doesn't become ready
   *
   * @param handlers - Array of HTTP handlers to register
   * @throws Error if server fails to start or doesn't become ready in time
   *
   * @example
   * ```typescript
   * const handlers = [createAPIUserHandlers(...)];
   * await server.start(handlers);
   * ```
   */
  async start(handlers: IHttpHandler[]): Promise<void> {
    this.server = createServer({
      logger: this.logger,
      routeHandlers: handlers,
    });

    const result = this.server.start({ port: this.port });

    if (!result.stop) {
      // biome-ignore lint: Throwing error on failed start
      throw new Error(`Failed to start test server on port ${this.port}`);
    }

    this.stopFn = result.stop;

    // Wait for server to be ready to accept connections
    await this.waitUntilReady();
  }

  /**
   * Stops the HTTP server gracefully.
   * Safe to call multiple times.
   *
   * @example
   * ```typescript
   * await server.stop();
   * ```
   */
  async stop(): Promise<void> {
    if (this.stopFn) {
      await this.stopFn();
      this.stopFn = undefined;
      this.server = undefined;
    }
  }

  /**
   * Returns the base URL for this test server.
   * Used by TestHttpClient for constructing request URLs.
   *
   * @returns Base URL (e.g., 'http://localhost:9000')
   *
   * @example
   * ```typescript
   * const client = new TestHttpClient(server.getBaseUrl());
   * ```
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Waits for server to start accepting connections using TCP port polling.
   *
   * Strategy:
   * - Makes HTTP HEAD requests to detect when port is listening
   * - Any HTTP response (200, 404, 401, etc.) means server is ready
   * - Connection refused/timeout means server not ready yet
   * - Uses exponential backoff: 10ms → 15ms → 22ms → 33ms → 50ms → ...
   * - Caps backoff at 500ms to prevent excessive waiting
   *
   * @param maxAttempts - Maximum number of connection attempts (default: 20)
   * @param initialDelayMs - Initial delay between attempts in ms (default: 10)
   * @throws Error if server doesn't become ready after maxAttempts
   */
  private async waitUntilReady(
    maxAttempts: number = 20,
    initialDelayMs: number = 10,
  ): Promise<void> {
    let attempt = 0;
    let delay = initialDelayMs;

    while (attempt < maxAttempts) {
      try {
        // Attempt connection with 100ms timeout
        await fetch(`http://localhost:${this.port}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(100),
        });

        // If we get here, server responded (even with 404/401) - it's ready!
        return;
      } catch (error) {
        // Check if it's a connection error (server not ready)
        const isConnectionError = this.isConnectionError(error);

        if (isConnectionError) {
          attempt++;

          if (attempt >= maxAttempts) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error';
            throw new Error(
              `Test server on port ${this.port} failed to start after ${maxAttempts} attempts. ` +
                `Last error: ${errorMessage}`,
            );
          }

          // Exponential backoff with cap at 500ms
          await this.sleep(delay);
          delay = Math.min(delay * 1.5, 500);
        } else {
          // Got HTTP response (even an error response) - server is ready
          return;
        }
      }
    }
  }

  /**
   * Determines if an error is a connection error (server not ready).
   *
   * @param error - Error from fetch attempt
   * @returns true if connection error, false if HTTP error
   */
  private isConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const errorName = error.name;
    const errorMessage = error.message;

    // Check for known connection error patterns
    return (
      errorName === 'TimeoutError' ||
      errorMessage.includes('ECONNREFUSED') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('Connection refused')
    );
  }

  /**
   * Delays execution for specified milliseconds.
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
