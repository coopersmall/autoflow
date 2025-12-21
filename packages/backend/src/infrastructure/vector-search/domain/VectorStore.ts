import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { VectorIndexConfig } from './VectorIndexSchema';

/**
 * Low-level vector store client interface.
 * Wraps Redis FT.* and HASH commands for vector operations.
 */
export interface IVectorStoreClient {
  /**
   * Creates a vector index if it doesn't exist.
   */
  createIndex(
    indexName: string,
    keyPrefix: string,
    config: VectorIndexConfig,
  ): Promise<Result<void, AppError>>;

  /**
   * Checks if an index exists.
   */
  indexExists(indexName: string): Promise<Result<boolean, AppError>>;

  /**
   * Drops an index (does not delete documents).
   */
  dropIndex(indexName: string): Promise<Result<void, AppError>>;

  /**
   * Stores a hash with the given fields.
   * Supports string, number, and Buffer values directly.
   */
  hset(
    key: string,
    fields: Record<string, string | number | Buffer>,
  ): Promise<Result<void, AppError>>;

  /**
   * Sets TTL on a key.
   */
  expire(key: string, seconds: number): Promise<Result<void, AppError>>;

  /**
   * Deletes a key.
   */
  del(key: string): Promise<Result<void, AppError>>;

  /**
   * Executes FT.SEARCH command.
   */
  ftSearch(
    indexName: string,
    query: string,
    args: (string | Buffer)[],
  ): Promise<Result<unknown[], AppError>>;
}
