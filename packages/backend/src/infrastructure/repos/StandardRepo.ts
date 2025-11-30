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
import { convertQueryResultsToData } from '@backend/infrastructure/repos/actions/convertQueryResultsToData';
import { createDatabaseClientFactory } from '@backend/infrastructure/repos/clients/DatabaseClientFactory';
import type { IRelationalDatabaseAdapter } from '@backend/infrastructure/repos/domain/DatabaseAdapter';
import type { IDatabaseClient } from '@backend/infrastructure/repos/domain/DatabaseClient';
import {
  createNotFoundError,
  type DBError,
} from '@backend/infrastructure/repos/errors/DBError';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { UserId } from '@core/domain/user/user';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ValidationError } from '@core/errors/ValidationError';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';
import { createRelationalDatabaseAdapter } from './adapters/RelationalDatabaseAdapter';

/**
 * Extracted public methods of StandardRepo for dependency injection and testing.
 * Hides implementation details and provides clean interface for consumers.
 */
export type IStandardRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<StandardRepo<ID, T>>;

/**
 * Repository for user-scoped data with automatic user isolation.
 * Provides CRUD operations with userId-based filtering and validation.
 * Ensures users can only access their own data.
 */
export class StandardRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  private adapter?: IRelationalDatabaseAdapter;
  /**
   * Creates a new standard repository instance.
   * @param appConfig - Application configuration service
   * @param tableName - Database table name for this repository
   * @param validator - Zod validator function for domain entity validation
   * @param dependencies - Injectable dependencies for testing
   */
  constructor(
    private readonly appConfig: IAppConfigurationService,
    private readonly tableName: string,
    private readonly validator: (data: unknown) => Result<T, ValidationError>,
    private readonly dependencies = {
      createRelationalDatabaseAdapter,
      convertQueryResultsToData,
      createDatabaseClientFactory,
    },
  ) {}

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
    const result = await adapterResult.value.findUnique({
      where: { id, userId },
    });
    if (result.isErr()) {
      return err(result.error);
    }
    const dataResult = this.dependencies.convertQueryResultsToData(
      result.value,
      this.validator,
    );
    if (dataResult.isErr()) {
      return err(dataResult.error);
    }
    if (dataResult.value.length === 0) {
      return err(createNotFoundError());
    }
    return ok(dataResult.value[0]);
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
    const result = await adapterResult.value.findMany({
      where: { userId },
      limit: opts?.limit,
    });
    if (result.isErr()) {
      return err(result.error);
    }
    return this.dependencies.convertQueryResultsToData(
      result.value,
      this.validator,
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
    const result = await adapterResult.value.create({
      id,
      userId,
      createdAt: new Date(),
      data,
    });
    if (result.isErr()) {
      return err(result.error);
    }
    const dataResult = this.dependencies.convertQueryResultsToData(
      result.value,
      this.validator,
    );
    if (dataResult.isErr()) {
      return err(dataResult.error);
    }
    return ok(dataResult.value[0]);
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
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...dataOnly
    } = data;
    const result = await adapterResult.value.update({
      where: {
        id,
        updatedAt: new Date(),
        userId,
      },
      data: dataOnly,
    });
    if (result.isErr()) {
      return err(result.error);
    }
    const dataResult = this.dependencies.convertQueryResultsToData(
      result.value,
      this.validator,
    );
    if (dataResult.isErr()) {
      return err(dataResult.error);
    }
    if (dataResult.value.length === 0) {
      return err(createNotFoundError());
    }
    return ok(dataResult.value[0]);
  }

  /**
   * Deletes a record for the specified user and returns it.
   * Only deletes if record is owned by the specified user.
   * @param id - Unique identifier of the record to delete
   * @param userId - ID of the user who owns the record
   * @returns Deleted record or database/validation error if not found or access denied
   */
  async delete(id: ID, userId: string): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }
    const result = await adapterResult.value.delete({ where: { id, userId } });
    if (result.isErr()) {
      return err(result.error);
    }
    const dataResult = this.dependencies.convertQueryResultsToData(
      result.value,
      this.validator,
    );
    if (dataResult.isErr()) {
      return err(dataResult.error);
    }
    if (dataResult.value.length === 0) {
      return err(createNotFoundError());
    }
    return ok(dataResult.value[0]);
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

  private getAdapter(): Result<IRelationalDatabaseAdapter, DBError> {
    if (this.adapter) {
      return ok(this.adapter);
    }
    const factory = this.dependencies.createDatabaseClientFactory(
      this.appConfig,
    );
    const adapter = this.dependencies.createRelationalDatabaseAdapter({
      clientFactory: factory,
      tableName: this.tableName,
    });
    this.adapter = adapter;
    return ok(adapter);
  }
}
