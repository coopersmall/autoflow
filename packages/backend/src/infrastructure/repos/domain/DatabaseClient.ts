/**
 * Database client abstraction interfaces.
 *
 * Defines the contracts for database client factories and connections used throughout
 * the repository layer. These abstractions allow different database implementations
 * (e.g., Bun SQL, Postgres, MySQL) to be swapped without changing repository code.
 */
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';
import zod from 'zod';

/**
 * Supported database client types.
 * Currently supports Bun SQL, with room for Postgres, MySQL, etc.
 */
const databaseClients = zod.enum(['bun-sql']);
export type DatabaseClientType = zod.infer<typeof databaseClients>;

/**
 * Database client interface representing SQL query execution.
 * Supports tagged template literals and parameter escaping.
 */
export interface IDatabaseClient {
  (strings: string[] | TemplateStringsArray, ...values: unknown[]): unknown;
  (obj: unknown): unknown;
  close(): Promise<void>;
}

/**
 * Factory interface for creating database clients.
 * Supports multiple database implementations via type parameter.
 */
export interface IDatabaseClientFactory {
  /**
   * Creates a database client for the specified type and table.
   * @param type - Database client type ('bun-sql', 'postgres', etc.)
   * @param table - Table name for context in errors
   * @returns Database client or configuration error
   */
  getDatabase(
    type: DatabaseClientType,
    table: string,
  ): Result<IDatabaseClient, ErrorWithMetadata>;
}
