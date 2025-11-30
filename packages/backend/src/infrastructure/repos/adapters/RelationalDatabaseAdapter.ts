/**
 * Relational database adapter implementation using database clients.
 *
 * This adapter provides SQL query generation for CRUD operations with support for
 * both user-scoped and global data patterns. Uses progressive query composition
 * to build SQL statements conditionally based on parameters.
 *
 * Security:
 * - All queries use parameterized values to prevent SQL injection
 * - User ID filtering is applied at the SQL level when provided
 * - RETURNING clauses ensure atomic read-after-write consistency
 *
 * Architecture:
 * - Uses DatabaseClientFactory for connection management
 * - Supports multiple database types via type parameter
 * - Builds queries progressively: base → filters → terminal clauses
 * - Validates all results with RawDatabaseQuery schema
 * - Returns raw results for repository layer validation
 */

import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import type {
  DatabaseClientType,
  IDatabaseClient,
} from '@backend/infrastructure/repos/domain/DatabaseClient';
import {
  type RawDatabaseQuery,
  validateRawDatabaseQuery,
} from '@backend/infrastructure/repos/domain/RawDatabaseQuery';
import { createDatabaseError } from '@backend/infrastructure/repos/errors/DBError';
import { createCachedGetter } from '@backend/infrastructure/utils/createCachedGetter';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ValidationError } from '@core/errors/ValidationError';
import type { Result } from 'neverthrow';
import { err } from 'neverthrow';
import { createDatabaseClientFactory } from '../clients/DatabaseClientFactory.ts';

/**
 * Factory function for creating RelationalDatabaseAdapter instances.
 * @param clientFactory - Database client factory
 * @param tableName - Database table name
 * @param clientType - Database client type (defaults to 'bun-sql')
 * @returns Configured database adapter instance
 */
export function createRelationalDatabaseAdapter({
  appConfig,
  tableName,
  clientType = 'bun-sql',
  dependencies = {
    createDatabaseClientFactory,
  },
}: {
  appConfig: IAppConfigurationService;
  tableName: string;
  clientType?: DatabaseClientType;
  dependencies?: {
    createDatabaseClientFactory: typeof createDatabaseClientFactory;
  };
}): IRelationalDatabaseAdapter {
  const factory = dependencies.createDatabaseClientFactory(appConfig);

  const getClient = createCachedGetter(() =>
    factory.getDatabase(clientType, tableName),
  );

  return Object.freeze(new RelationalDatabaseAdapter(tableName, getClient));
}

/**
 * Concrete implementation of database adapter for relational databases.
 * Generates parameterized SQL queries with optional user filtering.
 * Supports multiple database types via client factory.
 */
class RelationalDatabaseAdapter implements IRelationalDatabaseAdapter {
  /**
   * Creates a new database adapter instance.
   * @param tableName - Database table name for all operations
   * @param getClient - Cached getter function for database client
   */
  constructor(
    private readonly tableName: string,
    readonly getClient: () => Result<IDatabaseClient, ErrorWithMetadata>,
  ) {}

  /**
   * Finds a single record by ID with optional user filtering.
   * Builds SELECT query with WHERE id = ? and optional AND user_id = ?, limited to 1 result.
   * @param args - Query arguments with ID and optional userId
   * @returns Single record in array or empty array if not found, or validation error
   */
  async findUnique(args: {
    where: { id: string; userId?: string };
  }): Promise<Result<RawDatabaseQuery, ValidationError>> {
    const db = this.getClient();
    if (db.isErr()) {
      return err(db.error);
    }
    try {
      let query = db.value`
            SELECT * FROM ${db.value(this.tableName)}
            WHERE id = ${args.where.id}
            `;

      if (args.where.userId) {
        query = db.value`
                ${query}
                AND user_id = ${args.where.userId}
            `;
      }

      query = db.value`
            ${query}
            LIMIT 1
            `;

      const result = await query;
      return validateRawDatabaseQuery(result);
    } catch (error) {
      return err(createDatabaseError(error));
    }
  }

  /**
   * Finds multiple records with optional user filtering and limit.
   * Builds SELECT query with optional WHERE user_id = ? and LIMIT clauses.
   * @param args - Query arguments with optional userId and limit
   * @returns Array of matching records (empty if none found) or validation error
   */
  async findMany(args?: {
    where?: { userId?: string };
    limit?: number;
  }): Promise<Result<RawDatabaseQuery, ValidationError>> {
    const db = this.getClient();
    if (db.isErr()) {
      return err(db.error);
    }
    try {
      let query = db.value`
            SELECT * FROM ${db.value(this.tableName)}
            `;

      if (args?.where?.userId) {
        query = db.value`
                ${query}
                WHERE user_id = ${args.where.userId}
            `;
      }

      if (args?.limit) {
        query = db.value`
                ${query}
                LIMIT ${args.limit}
            `;
      }

      const result = await query;
      return validateRawDatabaseQuery(result);
    } catch (error) {
      return err(createDatabaseError(error));
    }
  }

  /**
   * Creates a new record with optional user association.
   * Generates INSERT INTO with conditional user_id column based on userId parameter.
   * Uses RETURNING * to return the created record.
   * @param args - Creation arguments with ID, timestamp, optional userId, and data
   * @returns Created record or validation error
   */
  async create(args: {
    id: string;
    createdAt: Date;
    userId?: string;
    data: unknown;
  }): Promise<Result<RawDatabaseQuery, ValidationError>> {
    const db = this.getClient();
    if (db.isErr()) {
      return err(db.error);
    }
    try {
      if (args.userId) {
        const result = await db.value`
                INSERT INTO ${db.value(this.tableName)} (id, user_id, created_at, data)
                VALUES (${args.id}, ${args.userId}, ${args.createdAt}, ${args.data})
                RETURNING *
            `;
        return validateRawDatabaseQuery(result);
      } else {
        const result = await db.value`
                INSERT INTO ${db.value(this.tableName)} (id, created_at, data)
                VALUES (${args.id}, ${args.createdAt}, ${args.data})
                RETURNING *
            `;
        return validateRawDatabaseQuery(result);
      }
    } catch (error) {
      return err(createDatabaseError(error));
    }
  }

  /**
   * Updates an existing record with optional user filtering.
   * Builds UPDATE query with SET data and updated_at, WHERE id = ? and optional AND user_id = ?.
   * Uses RETURNING * to return the updated record.
   * @param args - Update arguments with ID, timestamp, optional userId, and partial data
   * @returns Updated record or validation error
   */
  async update(args: {
    where: {
      id: string;
      updatedAt: Date;
      userId?: string;
    };
    data: unknown;
  }): Promise<Result<RawDatabaseQuery, ValidationError>> {
    const db = this.getClient();
    if (db.isErr()) {
      return err(db.error);
    }
    try {
      // Use JSONB concatenation (||) for partial updates - merges new data with existing
      let query = db.value`
                UPDATE ${db.value(this.tableName)}
                SET data = data || ${args.data}, updated_at = ${args.where.updatedAt}
                WHERE id = ${args.where.id}
                `;

      if (args.where.userId) {
        query = db.value`
                    ${query}
                    AND user_id = ${args.where.userId}
                `;
      }

      query = db.value`
                ${query}
                RETURNING *
                `;

      const result = await query;
      return validateRawDatabaseQuery(result);
    } catch (error) {
      return err(createDatabaseError(error));
    }
  }

  /**
   * Deletes a record with optional user filtering.
   * Builds DELETE query with WHERE id = ? and optional AND user_id = ?.
   * Uses RETURNING * to return the deleted record.
   * @param args - Deletion arguments with ID and optional userId
   * @returns Deleted record or validation error
   */
  async delete(args: {
    where: { id: string; userId?: string };
  }): Promise<Result<RawDatabaseQuery, ValidationError>> {
    const db = this.getClient();
    if (db.isErr()) {
      return err(db.error);
    }
    try {
      let query = db.value`
                    DELETE FROM ${db.value(this.tableName)}
                    WHERE id = ${args.where.id}
                    `;

      if (args.where.userId) {
        query = db.value`
                        ${query}
                        AND user_id = ${args.where.userId}
                    `;
      }

      query = db.value`
                    ${query}
                    RETURNING *
                    `;

      const result = await query;
      return validateRawDatabaseQuery(result);
    } catch (error) {
      return err(createDatabaseError(error));
    }
  }
}
