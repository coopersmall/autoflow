/**
 * Bun SQL database client implementation.
 *
 * Provides a wrapper around Bun's native SQL client for type safety and abstraction.
 * Implements IDatabaseClient interface to allow swapping database implementations.
 */
// import { getClient } from '@backend/infrastructure/repos/clients/ConnectionPool';
import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import { SQL } from 'bun';

/**
 * Factory function for creating Bun database clients.
 * Uses connection pooling to reuse connections across the application.
 * @param url - Database connection URL
 * @returns Configured Bun database client
 */
export function createBunDatabaseClient(url: string): IDatabaseClient {
  return Object.freeze(getClient(url));
}

let client: SQL | null = null;

function getClient(url: string): SQL {
  if (client) {
    return client;
  }
  client = new SQL(url, {
    max: 100,
    connectionTimeout: 10000,
  });
  return client;
}
