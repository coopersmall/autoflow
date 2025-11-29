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
import { convertQueryResultsToData } from '@backend/repos/actions/convertQueryResultsToData';
import { createDatabaseClientFactory } from '@backend/repos/clients/DatabaseClientFactory';
import type { IRelationalDatabaseAdapter } from '@backend/repos/domain/DatabaseAdapter';
import type { IDatabaseClient } from '@backend/repos/domain/DatabaseClient';
import {
  createNotFoundError,
  type DBError,
} from '@backend/repos/errors/DBError';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { Id } from '@core/domain/Id';
import type { Item } from '@core/domain/Item';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ValidationError } from '@core/errors/ValidationError';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';
import { createRelationalDatabaseAdapter } from './adapters/RelationalDatabaseAdapter';

/**
 * Extracted public methods of SharedRepo for dependency injection and testing.
 * Hides implementation details and provides clean interface for consumers.
 */
export type ISharedRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> = ExtractMethods<SharedRepo<ID, T>>;

/**
 * Repository for globally accessible data without user scoping.
 * Provides CRUD operations with automatic validation and error handling.
 * All data is accessible without user context.
 */
export class SharedRepo<
  ID extends Id<string> = Id<string>,
  T extends Item<ID> = Item<ID>,
> {
  private adapter?: IRelationalDatabaseAdapter;

  /**
   * Creates a new shared repository instance.
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
   * Retrieves a single record by ID from global data.
   * @param id - Unique identifier of the record
   * @returns Record if found, NotFoundError if doesn't exist, or database/validation error
   */
  async get(id: ID): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }
    const result = await adapterResult.value.findUnique({ where: { id } });
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
    const result = await adapterResult.value.findMany({
      where: {},
      limit: opts?.limit,
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

    return ok(dataResult.value);
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
    const result = await adapterResult.value.create({
      id,
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
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...partialData
    } = data;
    const result = await adapterResult.value.update({
      where: {
        id,
        updatedAt: new Date(),
      },
      data: partialData,
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
   * Deletes a global record and returns it.
   * @param id - Unique identifier of the record to delete
   * @returns Deleted record or database/validation error
   */
  async delete(id: ID): Promise<Result<T, DBError>> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }
    const result = await adapterResult.value.delete({ where: { id } });
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
   * @returns Database connection or configuration error
   */
  getClient(): Result<IDatabaseClient, DBError> {
    const adapterResult = this.getAdapter();
    if (adapterResult.isErr()) {
      return err(adapterResult.error);
    }
    return adapterResult.value.getClient();
  }

  /**
   * Lazily initializes and returns the relational database adapter.
   * Caches the adapter instance for future use.
   * @returns Relational database adapter or configuration error
   */
  private getAdapter(): Result<IRelationalDatabaseAdapter, ErrorWithMetadata> {
    if (this.adapter) {
      return ok(this.adapter);
    }
    const clientFactory = this.dependencies.createDatabaseClientFactory(
      this.appConfig,
    );
    this.adapter = this.dependencies.createRelationalDatabaseAdapter({
      clientFactory,
      tableName: this.tableName,
    });
    return ok(this.adapter);
  }
}
