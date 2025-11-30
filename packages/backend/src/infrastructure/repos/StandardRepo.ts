/**
 * Repository for user-scoped data with automatic isolation between users.
 *
 * StandardRepo provides CRUD operations for data that belongs to specific users,
 * such as documents, preferences, or any user-specific records. All operations
 * require a userId parameter and automatically filter data to ensure users can
 * only access their own records.
 *
 * Security guarantees:
 * - All queries automatically include userId filtering at the database level
 * - Users cannot access other users' data even with valid IDs
 * - Foreign key constraints enforce data integrity
 *
 * For globally accessible data that doesn't belong to users, use SharedRepo instead.
 *
 * Architecture:
 * - Uses RelationalDatabaseAdapter with userId filtering for all operations
 * - Validates all data with Zod schemas before returning to domain layer
 * - Converts raw database results (snake_case) to domain entities (camelCase)
 * - Returns Result types for functional error handling
 */

import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import {
  createRecord,
  deleteRecord,
  getAllRecords,
  getRecord,
  updateRecord,
} from '@backend/infrastructure/repos/actions/standard';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { DBError } from '@backend/infrastructure/repos/errors/DBError';
import { createCachedGetter } from '@backend/infrastructure/utils/createCachedGetter';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ValidationError } from '@core/errors/ValidationError';
import type { ExtractMethods } from '@core/types';
import { err, ok, type Result } from 'neverthrow';
import { createRelationalDatabaseAdapter } from './adapters/RelationalDatabaseAdapter.ts';

/**
 * Extracted public methods of StandardRepo for dependency injection and testing.
 * Hides implementation details and provides clean interface for consumers.
 */
export type IStandardRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<StandardRepo<ID, T>>;

interface StandardRepoDependencies {
  createRelationalDatabaseAdapter: typeof createRelationalDatabaseAdapter;
}

interface StandardRepoActions {
  getRecord: typeof getRecord;
  getAllRecords: typeof getAllRecords;
  createRecord: typeof createRecord;
  updateRecord: typeof updateRecord;
  deleteRecord: typeof deleteRecord;
}

/**
 * Repository for user-scoped data with automatic user isolation.
 * Provides CRUD operations with userId-based filtering and validation.
 * Ensures users can only access their own data.
 */
export class StandardRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  private readonly getAdapter: () => Result<IRelationalDatabaseAdapter, never>;

  /**
   * Creates a new standard repository instance.
   * @param tableName - Database table name for this repository
   * @param appConfig - Application configuration service
   * @param validator - Zod validator function for domain entity validation
   * @param standardRepoActions - Injectable actions for testing
   * @param dependencies - Injectable dependencies for testing
   */
  constructor(
    private readonly tableName: string,
    private readonly appConfig: IAppConfigurationService,
    private readonly validator: (data: unknown) => Result<T, ValidationError>,
    dependencies: StandardRepoDependencies = {
      createRelationalDatabaseAdapter,
    },
    private readonly standardRepoActions: StandardRepoActions = {
      getRecord,
      getAllRecords,
      createRecord,
      updateRecord,
      deleteRecord,
    },
  ) {
    this.getAdapter = createCachedGetter(() =>
      ok(
        dependencies.createRelationalDatabaseAdapter({
          appConfig: this.appConfig,
          tableName: this.tableName,
        }),
      ),
    );
  }

  /**
   * Retrieves a single record by ID for the specified user.
   * Automatically filters by userId to prevent cross-user data access.
   * @param id - Unique identifier of the record
   * @param userId - ID of the user who owns the record
   * @returns Record if found and owned by user, NotFoundError if doesn't exist or access denied, or database/validation error
   */
  async get(id: ID, userId: UserId): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.standardRepoActions.getRecord(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { id, userId },
    );
  }

  /**
   * Retrieves all records for the specified user with optional limit.
   * Automatically filters by userId to prevent cross-user data access.
   * @param userId - ID of the user whose records to retrieve
   * @param opts - Query options
   * @param opts.limit - Optional maximum number of records to return
   * @returns Array of user's records (empty if none found) or database/validation error
   */
  async all(
    userId: UserId,
    opts?: { limit?: number },
  ): Promise<Result<T[], ErrorWithMetadata>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.standardRepoActions.getAllRecords(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { userId, limit: opts?.limit },
    );
  }

  /**
   * Creates a new record for the specified user.
   * Automatically sets createdAt timestamp and associates record with userId.
   * @param id - Unique identifier for the new record
   * @param userId - ID of the user who will own the record
   * @param data - Domain entity data without id, createdAt, or updatedAt
   * @returns Created record or database/validation error
   */
  async create(
    id: ID,
    userId: UserId,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.standardRepoActions.createRecord(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { id, userId, data },
    );
  }

  /**
   * Updates an existing record for the specified user.
   * Automatically updates updatedAt timestamp. Supports partial updates.
   * Only updates if record is owned by the specified user.
   * @param id - Unique identifier of the record to update
   * @param userId - ID of the user who owns the record
   * @param data - Partial domain entity data to update
   * @returns Updated record or database/validation error if not found or access denied
   */
  async update(
    id: ID,
    userId: UserId,
    data: Partial<T>,
  ): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.standardRepoActions.updateRecord(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { id, userId, data },
    );
  }

  /**
   * Deletes a record for the specified user and returns it.
   * Only deletes if record is owned by the specified user.
   * @param id - Unique identifier of the record to delete
   * @param userId - ID of the user who owns the record
   * @returns Deleted record or database/validation error if not found or access denied
   */
  async delete(id: ID, userId: UserId): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.standardRepoActions.deleteRecord(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { id, userId },
    );
  }

  /**
   * Provides direct database access for complex queries.
   * Use repository methods when possible for consistency and validation.
   * @param userId - ID of the user for context (note: does not automatically filter queries)
   * @returns Database connection or configuration error
   */
  getClient(_userId: UserId): Result<IDatabaseClient, DBError> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }
    return adapterResult.value.getClient();
  }
}
