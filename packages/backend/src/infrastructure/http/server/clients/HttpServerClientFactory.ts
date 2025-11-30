/**
 * Factory for creating HTTP server client instances.
 *
 * Manages instantiation of HTTP server clients (Bun, Node, etc.) with proper
 * error handling. Returns Result types to handle creation errors gracefully.
 *
 * Architecture:
 * - Returns Result types for error handling
 * - Supports multiple client types (currently Bun)
 * - Provides clean interface for dependency injection
 * - Lightweight and stateless (no configuration dependencies)
 */
import { createBunHttpServerClient } from '@backend/infrastructure/http/server/clients/bun/BunHttpServerClient';
import type {
  HttpServerClientType,
  IHttpServerClient,
  IHttpServerClientFactory,
} from '@backend/infrastructure/http/server/domain/HttpServerClient';
import { createHttpServerError } from '@backend/infrastructure/http/server/errors/HttpServerError';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

/**
 * Factory function for creating HttpServerClientFactory instances.
 * @returns Configured HTTP server client factory
 */
export function createHttpServerClientFactory(): IHttpServerClientFactory {
  return Object.freeze(new HttpServerClientFactory());
}

/**
 * Concrete implementation of HTTP server client factory.
 * Creates and configures server client instances based on type.
 */
class HttpServerClientFactory implements IHttpServerClientFactory {
  /**
   * Creates an HTTP server client instance.
   * Currently supports Bun only.
   * @param type - Server client type ('bun', 'node', etc.)
   * @returns Server client or creation error
   */
  getServerClient(
    type: HttpServerClientType,
  ): Result<IHttpServerClient, ErrorWithMetadata> {
    switch (type) {
      case 'bun':
        return this.getBunClient();
      default:
        return err(
          createHttpServerError(new Error('Unsupported server client type'), {
            type,
          }),
        );
    }
  }

  /**
   * Creates a Bun HTTP server client.
   * @returns Bun server client or error
   */
  private getBunClient(): Result<IHttpServerClient, ErrorWithMetadata> {
    try {
      const client = createBunHttpServerClient();
      return ok(client);
    } catch (error) {
      return err(
        createHttpServerError(error, {
          message: 'Failed to create Bun server client',
        }),
      );
    }
  }
}
