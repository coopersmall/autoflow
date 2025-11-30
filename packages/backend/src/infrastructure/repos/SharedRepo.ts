/**
 * Repository for globally accessible data without user scoping.
 *
 * SharedRepo provides CRUD operations for data that doesn't belong to specific users,
 * such as the users table itself, global settings, public templates, or system configuration.
 * All operations work directly with IDs without requiring userId parameters.
 *
 * For user-scoped data that requires isolation between users, use StandardRepo instead.
 *
 * Architecture:
 * - Uses RelationalDatabaseAdapter for database operations
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
} from '@backend/infrastructure/repos/actions/shared';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import type { DBError } from '@backend/infrastructure/repos/errors/DBError';
import { createCachedGetter } from '@backend/infrastructure/utils/createCachedGetter';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ValidationError } from '@core/errors/ValidationError';
import type { ExtractMethods } from '@core/types';
import { err, ok, type Result } from 'neverthrow';
import { createRelationalDatabaseAdapter } from './adapters/RelationalDatabaseAdapter.ts';

/**
 * Extracted public methods of SharedRepo for dependency injection and testing.
 * Hides implementation details and provides clean interface for consumers.
 */
export type ISharedRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<SharedRepo<ID, T>>;

interface SharedRepoDependencies {
  createRelationalDatabaseAdapter: typeof createRelationalDatabaseAdapter;
}

interface SharedRepoActions {
  getRecord: typeof getRecord;
  getAllRecords: typeof getAllRecords;
  createRecord: typeof createRecord;
  updateRecord: typeof updateRecord;
  deleteRecord: typeof deleteRecord;
}

/**
 * Repository for globally accessible data without user scoping.
 * Provides CRUD operations with automatic validation and error handling.
 * All data is accessible without user context.
 */
export class SharedRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> implements ISharedRepo<ID, T>
{
  private readonly getAdapter: () => Result<IRelationalDatabaseAdapter, never>;

  /**
   * Creates a new shared repository instance.
   * @param tableName - Database table name for this repository
   * @param appConfig - Application configuration service
   * @param validator - Zod validator function for domain entity validation
   * @param sharedRepoActions - Injectable actions for testing
   * @param dependencies - Injectable dependencies for testing
   */
  constructor(
    private readonly tableName: string,
    private readonly appConfig: IAppConfigurationService,
    private readonly validator: (data: unknown) => Result<T, ValidationError>,
    dependencies: SharedRepoDependencies = {
      createRelationalDatabaseAdapter,
    },
    private readonly sharedRepoActions: SharedRepoActions = {
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
   * Retrieves a single record by ID from global data.
   * @param id - Unique identifier of the record
   * @returns Record if found, NotFoundError if doesn't exist, or database/validation error
   */
  async get(id: ID): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.sharedRepoActions.getRecord(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { id },
    );
  }

  /**
   * Retrieves all records from global data with optional limit.
   * @param opts - Query options
   * @param opts.limit - Optional maximum number of records to return
   * @returns Array of records (empty if none found) or database/validation error
   */
  async all(opts?: {
    limit?: number;
  }): Promise<Result<T[], ErrorWithMetadata>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.sharedRepoActions.getAllRecords(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { limit: opts?.limit },
    );
  }

  /**
   * Creates a new global record.
   * Automatically sets createdAt timestamp.
   * @param id - Unique identifier for the new record
   * @param data - Domain entity data without id, createdAt, or updatedAt
   * @returns Created record or database/validation error
   */
  async create(
    id: ID,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.sharedRepoActions.createRecord(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { id, data },
    );
  }

  /**
   * Updates an existing global record.
   * Automatically updates updatedAt timestamp. Supports partial updates.
   * @param id - Unique identifier of the record to update
   * @param data - Partial domain entity data to update
   * @returns Updated record or database/validation error
   */
  async update(id: ID, data: Partial<T>): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.sharedRepoActions.updateRecord(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { id, data },
    );
  }

  /**
   * Deletes a global record and returns it.
   * @param id - Unique identifier of the record to delete
   * @returns Deleted record or database/validation error
   */
  async delete(id: ID): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }

    return this.sharedRepoActions.deleteRecord(
      {
        adapter: adapterResult.value,
        validator: this.validator,
      },
      { id },
    );
  }

  /**
   * Provides direct database access for complex queries.
   * Use repository methods when possible for consistency and validation.
   * @returns Database connection or configuration error
   */
  getClient(): Result<IDatabaseClient, DBError> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }
    return adapterResult.value.getClient();
  }
}
