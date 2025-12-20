import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import type { VectorIndexConfig } from '../domain/VectorIndexSchema';
import type {
  VectorSearchOptions,
  VectorSearchResult,
} from '../domain/VectorSearchQuery';
import type { IVectorStoreClient } from '../domain/VectorStore';
import { buildFilterQuery } from './buildFilterQuery';
import { parseSearchResults } from './parseSearchResults';
import { serializeVector } from './serializeVector';

/**
 * Searches for similar documents in the vector store.
 */
export async function searchDocuments(
  client: IVectorStoreClient,
  indexName: string,
  embedding: number[],
  config: VectorIndexConfig,
  options?: VectorSearchOptions,
): Promise<Result<VectorSearchResult[], AppError>> {
  // Check if index exists
  const existsResult = await client.indexExists(indexName);
  if (existsResult.isErr()) {
    return err(existsResult.error);
  }

  if (!existsResult.value) {
    // Index doesn't exist, return empty results
    return ok([]);
  }

  // Build filter query
  const filterQuery = buildFilterQuery(options?.filter);

  // Serialize query vector
  const queryVector = serializeVector(embedding);

  // Build FT.SEARCH arguments
  const vectorField = config.vectorField ?? 'embedding';
  const topK = options?.topK ?? 10;
  const algorithm = config.algorithm ?? 'HNSW';

  // Build KNN query with filter
  // EF_RUNTIME is only applicable to HNSW indexes, not FLAT
  let knnQuery: string;
  if (algorithm === 'HNSW') {
    const efRuntime = config.hnswEfRuntime ?? 10;
    knnQuery = `(${filterQuery})=>[KNN ${topK} @${vectorField} $vector AS score]=>{$EF_RUNTIME: ${efRuntime}}`;
  } else {
    // FLAT index - no EF_RUNTIME parameter
    knnQuery = `(${filterQuery})=>[KNN ${topK} @${vectorField} $vector AS score]`;
  }

  // Build list of fields to return (score, content, and all schema fields)
  const returnFields = ['score', 'content'];
  if (config.schemaFields) {
    for (const field of config.schemaFields) {
      returnFields.push(field.name);
    }
  }

  // Build args including vector as Buffer
  const searchArgs: (string | Buffer)[] = [
    'PARAMS',
    '2',
    'vector',
    queryVector, // Pass Buffer directly
    'RETURN',
    String(returnFields.length),
    ...returnFields,
    'SORTBY',
    'score',
    'ASC',
    'LIMIT',
    '0',
    String(topK),
    'DIALECT',
    '2',
  ];

  // Execute search
  const searchResult = await client.ftSearch(indexName, knnQuery, searchArgs);

  if (searchResult.isErr()) {
    return err(searchResult.error);
  }

  // Parse results
  const parseResult = parseSearchResults(searchResult.value, 'score');
  if (parseResult.isErr()) {
    return err(parseResult.error);
  }

  // Apply score threshold if specified
  let results = parseResult.value;
  const scoreThreshold = options?.scoreThreshold;
  if (scoreThreshold) {
    results = results.filter((r) => r.score <= scoreThreshold);
  }

  return ok(results);
}
