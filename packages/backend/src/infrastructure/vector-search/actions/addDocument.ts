import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import type { VectorIndexConfig } from '../domain/VectorIndexSchema';
import type { VectorDocument } from '../domain/VectorSearchQuery';
import type { IVectorStoreClient } from '../domain/VectorStore';
import { createVectorStoreDimensionError } from '../errors/VectorStoreError';
import { serializeVector } from './serializeVector';

/**
 * Adds a document to the vector store.
 * Creates the index if it doesn't exist (on first add).
 */
export async function addDocument(
  client: IVectorStoreClient,
  indexName: string,
  keyPrefix: string,
  key: string,
  document: VectorDocument,
  config: VectorIndexConfig,
): Promise<Result<void, AppError>> {
  // Validate embedding dimensions before storing
  // Redis doesn't validate at write time, so we do it here to provide better error messages
  if (document.embedding.length !== config.dimensions) {
    return err(
      createVectorStoreDimensionError(
        new Error(
          `Embedding has ${document.embedding.length} dimensions, but index requires ${config.dimensions}`,
        ),
        {
          expected: config.dimensions,
          actual: document.embedding.length,
          key,
        },
      ),
    );
  }

  // Ensure index exists (idempotent operation)
  const createResult = await client.createIndex(indexName, keyPrefix, config);
  if (createResult.isErr()) {
    return err(createResult.error);
  }

  // Serialize the vector embedding to Buffer
  const vectorBuffer = serializeVector(document.embedding);

  // Build hash fields
  const fields: Record<string, string | number | Buffer> = {
    content: document.content,
    [config.vectorField ?? 'embedding']: vectorBuffer,
  };

  // Add metadata fields
  if (document.metadata) {
    for (const [key, value] of Object.entries(document.metadata)) {
      if (value !== undefined && value !== null) {
        // Convert values to strings or numbers for Redis storage
        if (typeof value === 'string' || typeof value === 'number') {
          fields[key] = value;
        } else if (typeof value === 'boolean') {
          fields[key] = value.toString();
        } else {
          // For complex types, stringify them
          fields[key] = JSON.stringify(value);
        }
      }
    }
  }

  // Store the document
  const setResult = await client.hset(key, fields);
  if (setResult.isErr()) {
    return err(setResult.error);
  }

  // Set TTL if configured
  if (config.ttlSeconds) {
    const expireResult = await client.expire(key, config.ttlSeconds);
    if (expireResult.isErr()) {
      return err(expireResult.error);
    }
  }

  return ok(undefined);
}
