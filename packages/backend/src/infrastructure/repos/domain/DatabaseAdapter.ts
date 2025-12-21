/**
 * Interface for relational database adapters.
 *
 * IRelationalDatabaseAdapter defines the contract for database operations used by
 * both SharedRepo and StandardRepo. Implementations must handle optional userId
 * parameters to support both global and user-scoped data patterns.
 *
 * All methods return RawDatabaseQuery results (not validated domain entities).
 * The repository layer is responsible for validation and conversion to domain types.
 */
import type { AppError } from '@core/errors/AppError';

import type { Result } from 'neverthrow';
import type { IDatabaseClient } from './DatabaseClient';
import type { RawDatabaseQuery } from './RawDatabaseQuery';

/**
 * Database adapter interface for CRUD operations on relational databases.
 * Supports both user-scoped and global data through optional userId parameters.
 * Returns raw database results that require validation before use.
 */
export interface IRelationalDatabaseAdapter {
  /**
   * Finds a single record by ID with optional user filtering.
   * @param args - Query arguments
   * @param args.where - Filter conditions
   * @param args.where.id - Record ID to find
   * @param args.where.userId - Optional user ID for filtering (used by StandardRepo)
   * @returns Single record in array or empty array if not found, or validation error
   */
  findUnique(args: {
    where: { id: string; userId?: string };
  }): Promise<Result<RawDatabaseQuery, AppError>>;

  /**
   * Finds multiple records with optional user filtering and limit.
   * @param args - Query arguments
   * @param args.where - Filter conditions
   * @param args.where.userId - Optional user ID for filtering (used by StandardRepo)
   * @param args.limit - Optional maximum number of records to return
   * @returns Array of records (empty if none found) or validation error
   */
  findMany(args?: {
    where?: { userId?: string };
    limit?: number;
  }): Promise<Result<RawDatabaseQuery, AppError>>;

  /**
   * Creates a new record with optional user association.
   * @param args - Creation arguments
   * @param args.id - Unique identifier for the record
   * @param args.createdAt - Creation timestamp
   * @param args.userId - Optional user ID to associate with record (used by StandardRepo)
   * @param args.data - Record data to store
   * @returns Created record or validation error
   */
  create(args: {
    id: string;
    createdAt: Date;
    userId?: string;
    data: unknown;
  }): Promise<Result<RawDatabaseQuery, AppError>>;

  /**
   * Updates an existing record with optional user filtering.
   * @param args - Update arguments
   * @param args.where - Filter conditions
   * @param args.where.id - Record ID to update
   * @param args.where.updatedAt - Update timestamp
   * @param args.where.userId - Optional user ID for filtering (used by StandardRepo)
   * @param args.data - Partial record data to update
   * @returns Updated record or validation error
   */
  update(args: {
    where: {
      id: string;
      updatedAt: Date;
      userId?: string;
    };
    data: unknown;
  }): Promise<Result<RawDatabaseQuery, AppError>>;

  /**
   * Deletes a record with optional user filtering.
   * @param args - Deletion arguments
   * @param args.where - Filter conditions
   * @param args.where.id - Record ID to delete
   * @param args.where.userId - Optional user ID for filtering (used by StandardRepo)
   * @returns Deleted record or validation error
   */
  delete(args: {
    where: { id: string; userId?: string };
  }): Promise<Result<RawDatabaseQuery, AppError>>;

  /**
   * Provides direct database connection for custom queries.
   * @returns Database connection or configuration error
   */
  getClient(): Result<IDatabaseClient, AppError>;
}
