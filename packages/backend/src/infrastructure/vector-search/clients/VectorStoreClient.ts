import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import { RedisClient as BunRedisClient } from 'bun';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';
import type { VectorIndexConfig } from '../domain/VectorIndexSchema';
import type { IVectorStoreClient } from '../domain/VectorStore';
import {
  createVectorStoreError,
  createVectorStoreIndexError,
} from '../errors/VectorStoreError';

/**
 * Factory function for creating VectorStoreClient instances.
 * Follows the same pattern as createRedisClient in the cache layer.
 */
export function createVectorStoreClient(
  appConfig: IAppConfigurationService,
): IVectorStoreClient {
  const redis = new BunRedisClient(appConfig.redisUrl, {});
  return Object.freeze(new VectorStoreClient(redis));
}

/**
 * Redis-based vector store client.
 * Wraps raw Redis FT.* commands for vector operations.
 */
class VectorStoreClient implements IVectorStoreClient {
  constructor(private readonly redis: BunRedisClient) {}

  async createIndex(
    indexName: string,
    keyPrefix: string,
    config: VectorIndexConfig,
  ): Promise<Result<void, AppError>> {
    // Build FT.CREATE command arguments - all must be strings for Redis
    const args: string[] = [
      indexName,
      'ON',
      'HASH',
      'PREFIX',
      '1',
      keyPrefix,
      'SCHEMA',
      'content',
      'TEXT',
    ];

    // Add metadata schema fields
    for (const field of config.schemaFields ?? []) {
      args.push(field.name, field.type);
      if (field.sortable) args.push('SORTABLE');
      if (field.noIndex) args.push('NOINDEX');
    }

    // Add vector field
    const vectorField = config.vectorField ?? 'embedding';
    const algorithm = config.algorithm ?? 'HNSW';

    if (algorithm === 'HNSW') {
      args.push(
        vectorField,
        'VECTOR',
        'HNSW',
        '10',
        'TYPE',
        'FLOAT32',
        'DIM',
        String(config.dimensions),
        'DISTANCE_METRIC',
        config.distanceMetric ?? 'COSINE',
        'M',
        String(config.hnswM ?? 16),
        'EF_CONSTRUCTION',
        String(config.hnswEfConstruction ?? 200),
      );
    } else {
      // FLAT algorithm
      args.push(
        vectorField,
        'VECTOR',
        'FLAT',
        '6',
        'TYPE',
        'FLOAT32',
        'DIM',
        String(config.dimensions),
        'DISTANCE_METRIC',
        config.distanceMetric ?? 'COSINE',
      );
    }

    try {
      await this.redis.send('FT.CREATE', args);
      return ok(undefined);
    } catch (error) {
      // Ignore "Index already exists" error
      if (
        error instanceof Error &&
        error.message.includes('Index already exists')
      ) {
        return ok(undefined);
      }
      return err(createVectorStoreIndexError(error, { indexName, keyPrefix }));
    }
  }

  async indexExists(indexName: string): Promise<Result<boolean, AppError>> {
    try {
      const result = await this.redis.send('FT._LIST', []);

      // Validate response is string array
      const indexesResult = validate(stringArraySchema, result);
      if (indexesResult.isErr()) {
        return err(
          createVectorStoreError(indexesResult.error, {
            operation: 'indexExists',
            reason: 'Invalid FT._LIST response',
          }),
        );
      }

      return ok(indexesResult.value.includes(indexName));
    } catch (error) {
      return err(
        createVectorStoreError(error, { operation: 'indexExists', indexName }),
      );
    }
  }

  async dropIndex(indexName: string): Promise<Result<void, AppError>> {
    try {
      await this.redis.send('FT.DROPINDEX', [indexName]);
      return ok(undefined);
    } catch (error) {
      // Ignore "Unknown Index name" error
      if (error instanceof Error && error.message.includes('Unknown Index')) {
        return ok(undefined);
      }
      return err(
        createVectorStoreError(error, { operation: 'dropIndex', indexName }),
      );
    }
  }

  async hset(
    key: string,
    fields: Record<string, string | number | Buffer>,
  ): Promise<Result<void, AppError>> {
    try {
      // Use redis.send instead of redis.hset to properly handle Buffer values.
      // The hset method doesn't correctly preserve binary data (UTF-8 encoding issue).
      const args: (string | Buffer)[] = [key];
      for (const [field, value] of Object.entries(fields)) {
        args.push(field);
        if (Buffer.isBuffer(value)) {
          args.push(value);
        } else {
          args.push(String(value));
        }
      }
      // Cast to string[] to satisfy TypeScript - Bun Redis actually handles Buffer values correctly
      // biome-ignore lint: @typescript/no-explicit-any
      await this.redis.send('HSET', args as string[]);
      return ok(undefined);
    } catch (error) {
      return err(createVectorStoreError(error, { operation: 'hset', key }));
    }
  }

  async expire(key: string, seconds: number): Promise<Result<void, AppError>> {
    try {
      await this.redis.send('EXPIRE', [key, String(seconds)]);
      return ok(undefined);
    } catch (error) {
      return err(createVectorStoreError(error, { operation: 'expire', key }));
    }
  }

  async del(key: string): Promise<Result<void, AppError>> {
    try {
      await this.redis.send('DEL', [key]);
      return ok(undefined);
    } catch (error) {
      return err(createVectorStoreError(error, { operation: 'del', key }));
    }
  }

  async ftSearch(
    indexName: string,
    query: string,
    args: (string | Buffer)[],
  ): Promise<Result<unknown[], AppError>> {
    try {
      // Cast to string[] to satisfy TypeScript - Bun Redis actually handles Buffer values correctly
      const result = await this.redis.send('FT.SEARCH', [
        indexName,
        query,
        ...args,
      ] as string[]);

      // Handle RESP3 format (object with total_results and results)
      // or RESP2 format (array with [total, key1, fields1, ...])
      if (result && typeof result === 'object' && !Array.isArray(result)) {
        // RESP3 format: { total_results: number, results: [...] }
        const validatedResp3Result = validate(resp3SearchResultSchema, result);
        if (validatedResp3Result.isErr()) {
          return err(
            createVectorStoreError(validatedResp3Result.error, {
              operation: 'ftSearch',
              reason: 'Invalid FT.SEARCH RESP3 response',
            }),
          );
        }
        const resp3Result = validatedResp3Result.value;

        // Convert to RESP2-style array for consistent parsing
        const total = resp3Result.total_results ?? 0;
        const results = resp3Result.results ?? [];

        const resp2Array: unknown[] = [total];
        for (const doc of results) {
          resp2Array.push(doc.id);
          // Convert extra_attributes to flat array [field1, value1, field2, value2, ...]
          const fields: unknown[] = [];
          if (doc.extra_attributes) {
            for (const [key, value] of Object.entries(doc.extra_attributes)) {
              fields.push(key);
              fields.push(String(value));
            }
          }
          resp2Array.push(fields);
        }

        return ok(resp2Array);
      }

      // Validate response is an array (RESP2 format)
      const arrayResult = validate(unknownArraySchema, result);
      if (arrayResult.isErr()) {
        return err(
          createVectorStoreError(arrayResult.error, {
            operation: 'ftSearch',
            reason: 'Invalid FT.SEARCH response',
          }),
        );
      }

      return ok(arrayResult.value);
    } catch (error) {
      return err(
        createVectorStoreError(error, { operation: 'ftSearch', indexName }),
      );
    }
  }
}

/**
 * Zod schemas for validating Redis responses.
 */
const stringArraySchema = zod.array(zod.string());
const unknownArraySchema = zod.array(zod.unknown());
const resp3SearchResultSchema = zod.object({
  total_results: zod.number().optional(),
  results: zod
    .array(
      zod.object({
        id: zod.string(),
        extra_attributes: zod.record(zod.unknown()).optional(),
      }),
    )
    .optional(),
});
