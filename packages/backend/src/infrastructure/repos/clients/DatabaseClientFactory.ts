/**
 * Factory for creating database client instances.
 *
 * Manages instantiation of database clients (Bun SQL, Postgres, etc.) with proper
 * configuration and error handling. Returns Result types to handle configuration
 * errors gracefully.
 *
 * Architecture:
 * - Validates configuration before creating clients
 * - Returns Result types for error handling
 * - Supports multiple client types (currently Bun SQL)
 * - Provides clean interface for dependency injection
 */

import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { createBunDatabaseClient } from '@backend/infrastructure/repos/clients/bun/BunDatabaseClient';
import type {
  DatabaseClientType,
  IDatabaseClient,
  IDatabaseClientFactory,
} from '@backend/infrastructure/repos/domain/DatabaseClient';
import { createDatabaseError } from '@backend/infrastructure/repos/errors/DBError';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

/**
 * Factory function for creating DatabaseClientFactory instances.
 * @param appConfig - Application configuration service
 * @returns Configured database client factory
 */
export function createDatabaseClientFactory(
  appConfig: IAppConfigurationService,
): IDatabaseClientFactory {
  return Object.freeze(new DatabaseClientFactory(appConfig));
}

/**
 * Concrete implementation of database client factory.
 * Creates and configures database client instances based on type.
 */
class DatabaseClientFactory implements IDatabaseClientFactory {
  private readonly url: string | undefined;

  /**
   * Creates a new database client factory.
   * @param appConfig - Application configuration service
   */
  constructor(private readonly appConfig: IAppConfigurationService) {
    this.url = this.appConfig.databaseUrl;
  }

  /**
   * Creates a database client for the specified type.
   * @param type - Database client type ('bun-sql', 'postgres', etc.)
   * @param table - Table name for context in errors
   * @returns Database client or configuration/creation error
   */
  getDatabase(
    type: DatabaseClientType,
    table: string,
  ): Result<IDatabaseClient, ErrorWithMetadata> {
    switch (type) {
      case 'bun-sql':
        return this.getBunSqlClient(table);
    }
  }

  /**
   * Creates a Bun SQL database client.
   * @param table - Table name for error context
   * @returns Bun SQL client or error
   */
  private getBunSqlClient(
    table: string,
  ): Result<IDatabaseClient, ErrorWithMetadata> {
    if (!this.url) {
      return err(
        createDatabaseError(new Error('Database URL not configured'), {
          table,
          configKey: 'databaseUrl',
        }),
      );
    }

    try {
      const client = createBunDatabaseClient(this.url);
      return ok(client);
    } catch (error) {
      return err(
        createDatabaseError(error, {
          message: 'Failed to create Bun SQL client',
          table,
          databaseUrl: this.url,
        }),
      );
    }
  }
}
