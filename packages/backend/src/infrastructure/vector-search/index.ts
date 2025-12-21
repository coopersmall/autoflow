/**
 * Vector Search Infrastructure
 *
 * Redis-based vector similarity search with support for:
 * - HNSW and FLAT algorithms
 * - Metadata filtering (TAG, NUMERIC, TEXT)
 * - Shared (global) and Standard (user-scoped) stores
 * - Automatic index creation
 * - Type-safe with Result-based error handling
 */

// Client factory
export { createVectorStoreClient } from './clients/VectorStoreClient';
export type {
  DistanceMetric,
  SchemaField,
  SchemaFieldType,
  VectorAlgorithm,
  VectorIndexConfig,
} from './domain/VectorIndexSchema';

// Domain types
export type {
  NumericRange,
  VectorDocument,
  VectorDocumentId,
  VectorFilter,
  VectorSearchOptions,
  VectorSearchResult,
} from './domain/VectorSearchQuery';
export type { IVectorStoreClient } from './domain/VectorStore';
// Error factories (for advanced usage)
export {
  createVectorStoreAddError,
  createVectorStoreDeleteError,
  createVectorStoreError,
  createVectorStoreIndexError,
  createVectorStoreSearchError,
} from './errors/VectorStoreError';
// Store classes
export {
  type ISharedVectorStore,
  SharedVectorStore,
  type SharedVectorStoreConfig,
} from './SharedVectorStore';
export {
  type IStandardVectorStore,
  StandardVectorStore,
  type StandardVectorStoreConfig,
} from './StandardVectorStore';
