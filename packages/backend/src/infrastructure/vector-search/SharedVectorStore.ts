/**
 * Vector store for globally accessible embeddings without user scoping.
 *
 * SharedVectorStore provides vector similarity search for data that is
 * accessible to all users, such as public documents or shared knowledge.
 *
 * Key Features:
 * - No user scoping - vectors are global
 * - Key format: `{namespace}/{id}`
 * - Index format: `{namespace}:idx`
 * - Type-safe with branded IDs
 * - Result types for error handling
 * - Automatic index creation on first add
 *
 * Example Usage:
 * ```typescript
 * const docsStore = new SharedVectorStore('docs', {
 *   appConfig,
 *   config: {
 *     dimensions: 1536,
 *     distanceMetric: 'COSINE',
 *     algorithm: 'HNSW',
 *   },
 * });
 *
 * // Add document
 * await docsStore.add('doc-123' as VectorDocumentId, {
 *   id: 'doc-123' as VectorDocumentId,
 *   embedding: [0.1, 0.2, ...],
 *   content: 'Document text',
 *   metadata: { category: 'tech' },
 * });
 *
 * // Search
 * const results = await docsStore.search(queryEmbedding, {
 *   topK: 10,
 *   filter: { tag: { category: 'tech' } },
 * });
 * ```
 */
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { createCachedGetter } from '@backend/infrastructure/utils/createCachedGetter';
import type { AppError } from '@core/errors/AppError';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';
import { addDocument } from './actions/addDocument';
import { deleteDocument } from './actions/deleteDocument';
import {
  generateSharedIndexName,
  generateSharedKeyPrefix,
  generateSharedVectorStoreKey,
} from './actions/generateVectorStoreKey';
import { searchDocuments } from './actions/searchDocuments';
import { createVectorStoreClient } from './clients/VectorStoreClient';
import type { VectorIndexConfig } from './domain/VectorIndexSchema';
import type {
  VectorDocument,
  VectorDocumentId,
  VectorSearchOptions,
  VectorSearchResult,
} from './domain/VectorSearchQuery';
import type { IVectorStoreClient } from './domain/VectorStore';

export type ISharedVectorStore = ExtractMethods<SharedVectorStore>;

/**
 * Configuration for SharedVectorStore construction.
 */
export interface SharedVectorStoreConfig {
  appConfig: IAppConfigurationService;
  config: VectorIndexConfig;
}

interface SharedVectorStoreDependencies {
  createVectorStoreClient: typeof createVectorStoreClient;
  addDocument: typeof addDocument;
  searchDocuments: typeof searchDocuments;
  deleteDocument: typeof deleteDocument;
  generateSharedVectorStoreKey: typeof generateSharedVectorStoreKey;
  generateSharedIndexName: typeof generateSharedIndexName;
  generateSharedKeyPrefix: typeof generateSharedKeyPrefix;
}

/**
 * Vector store class for globally accessible embeddings.
 * Provides vector similarity search without user scoping.
 */
export class SharedVectorStore {
  private readonly getClient: () => Result<IVectorStoreClient, AppError>;
  private readonly indexName: string;
  private readonly keyPrefix: string;

  /**
   * Creates a new SharedVectorStore instance.
   * @param namespace - Vector store namespace (e.g., 'docs', 'articles')
   * @param ctx - Vector store context with config
   * @param dependencies - Optional dependencies for testing
   */
  constructor(
    private readonly namespace: string,
    private readonly ctx: SharedVectorStoreConfig,
    private readonly dependencies: SharedVectorStoreDependencies = {
      createVectorStoreClient,
      addDocument,
      searchDocuments,
      deleteDocument,
      generateSharedVectorStoreKey,
      generateSharedIndexName,
      generateSharedKeyPrefix,
    },
  ) {
    // Pre-compute index name and key prefix
    this.indexName = this.dependencies.generateSharedIndexName(this.namespace);
    this.keyPrefix = this.dependencies.generateSharedKeyPrefix(this.namespace);

    // Create cached client getter
    this.getClient = createCachedGetter(() => {
      const client = this.dependencies.createVectorStoreClient(
        this.ctx.appConfig,
      );
      return ok(client);
    });
  }

  /**
   * Adds a document to the vector store.
   * @param id - Document ID
   * @param document - Document with embedding and metadata
   * @returns Success or error
   */
  async add(
    id: VectorDocumentId,
    document: VectorDocument,
  ): Promise<Result<void, AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const key = this.dependencies.generateSharedVectorStoreKey(
      this.namespace,
      id,
    );

    return this.dependencies.addDocument(
      clientResult.value,
      this.indexName,
      this.keyPrefix,
      key,
      document,
      this.ctx.config,
    );
  }

  /**
   * Searches for similar documents using vector similarity.
   * @param embedding - Query vector embedding
   * @param options - Search options (topK, filters, etc.)
   * @returns Array of search results or error
   */
  async search(
    embedding: number[],
    options?: VectorSearchOptions,
  ): Promise<Result<VectorSearchResult[], AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    return this.dependencies.searchDocuments(
      clientResult.value,
      this.indexName,
      embedding,
      this.ctx.config,
      options,
    );
  }

  /**
   * Deletes a document from the vector store.
   * @param id - Document ID
   * @returns Success or error
   */
  async delete(id: VectorDocumentId): Promise<Result<void, AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const key = this.dependencies.generateSharedVectorStoreKey(
      this.namespace,
      id,
    );

    return this.dependencies.deleteDocument(clientResult.value, key);
  }
}
