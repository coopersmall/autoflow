/**
 * Bun SQL database client implementation.
 *
 * Provides a wrapper around Bun's native SQL client for type safety and abstraction.
 * Implements IDatabaseClient interface to allow swapping database implementations.
 */
import { getClient } from '@backend/infrastructure/repos/clients/ConnectionPool';
import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';

/**
 * Factory function for creating Bun database clients.
 * Uses connection pooling to reuse connections across the application.
 * @param url - Database connection URL
 * @returns Configured Bun database client
 */
export function createBunDatabaseClient(url: string): IDatabaseClient {
  return getClient(url, 'bun-sql');
}
