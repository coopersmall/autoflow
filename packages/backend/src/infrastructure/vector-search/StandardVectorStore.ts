/**
 * Vector store for user-scoped embeddings.
 *
 * StandardVectorStore provides vector similarity search for data that is
 * scoped to individual users, such as personal documents or user-specific knowledge.
 *
 * Key Features:
 * - User scoping - each user has isolated vectors
 * - Key format: `user/{userId}/{namespace}/{id}`
 * - Index format: `user:{userId}:{namespace}:idx`
 * - Type-safe with branded IDs
 * - Result types for error handling
 * - Automatic index creation on first add
 *
 * Example Usage:
 * ```typescript
 * const notesStore = new StandardVectorStore('notes', {
 *   appConfig,
 *   config: {
 *     dimensions: 1536,
 *     distanceMetric: 'COSINE',
 *     algorithm: 'HNSW',
 *   },
 * });
 *
 * // Add document
 * await notesStore.add(
 *   'note-123' as VectorDocumentId,
 *   'user-456' as UserId,
 *   {
 *     id: 'note-123' as VectorDocumentId,
 *     embedding: [0.1, 0.2, ...],
 *     content: 'My note text',
 *     metadata: { tags: ['work'] },
 *   }
 * );
 *
 * // Search
 * const results = await notesStore.search(
 *   queryEmbedding,
 *   'user-456' as UserId,
 *   {
 *     topK: 5,
 *     filter: { tag: { tags: 'work' } },
 *   }
 * );
 * ```
 */
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { createCachedGetter } from '@backend/infrastructure/utils/createCachedGetter';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { ExtractMethods } from '@core/types';
import type { Result } from 'neverthrow';
import { err, ok } from 'neverthrow';
import { addDocument } from './actions/addDocument';
import { deleteDocument } from './actions/deleteDocument';
import {
  generateStandardIndexName,
  generateStandardKeyPrefix,
  generateStandardVectorStoreKey,
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

export type IStandardVectorStore = ExtractMethods<StandardVectorStore>;

/**
 * Configuration for StandardVectorStore construction.
 */
export interface StandardVectorStoreConfig {
  appConfig: IAppConfigurationService;
  config: VectorIndexConfig;
}

interface StandardVectorStoreDependencies {
  createVectorStoreClient: typeof createVectorStoreClient;
  addDocument: typeof addDocument;
  searchDocuments: typeof searchDocuments;
  deleteDocument: typeof deleteDocument;
  generateStandardVectorStoreKey: typeof generateStandardVectorStoreKey;
  generateStandardIndexName: typeof generateStandardIndexName;
  generateStandardKeyPrefix: typeof generateStandardKeyPrefix;
}

/**
 * Vector store class for user-scoped embeddings.
 * Provides vector similarity search with user isolation.
 */
export class StandardVectorStore {
  private readonly getClient: () => Result<IVectorStoreClient, AppError>;

  /**
   * Creates a new StandardVectorStore instance.
   * @param namespace - Vector store namespace (e.g., 'notes', 'documents')
   * @param ctx - Vector store context with config
   * @param dependencies - Optional dependencies for testing
   */
  constructor(
    private readonly namespace: string,
    private readonly ctx: StandardVectorStoreConfig,
    private readonly dependencies: StandardVectorStoreDependencies = {
      createVectorStoreClient,
      addDocument,
      searchDocuments,
      deleteDocument,
      generateStandardVectorStoreKey,
      generateStandardIndexName,
      generateStandardKeyPrefix,
    },
  ) {
    // Create cached client getter
    this.getClient = createCachedGetter(() => {
      const client = this.dependencies.createVectorStoreClient(
        this.ctx.appConfig,
      );
      return ok(client);
    });
  }

  /**
   * Adds a document to the vector store for a specific user.
   * @param id - Document ID
   * @param userId - User ID for scoping
   * @param document - Document with embedding and metadata
   * @returns Success or error
   */
  async add(
    id: VectorDocumentId,
    userId: UserId,
    document: VectorDocument,
  ): Promise<Result<void, AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const key = this.dependencies.generateStandardVectorStoreKey(
      this.namespace,
      id,
      userId,
    );
    const indexName = this.dependencies.generateStandardIndexName(
      this.namespace,
      userId,
    );
    const keyPrefix = this.dependencies.generateStandardKeyPrefix(
      this.namespace,
      userId,
    );

    return this.dependencies.addDocument(
      clientResult.value,
      indexName,
      keyPrefix,
      key,
      document,
      this.ctx.config,
    );
  }

  /**
   * Searches for similar documents using vector similarity for a specific user.
   * @param embedding - Query vector embedding
   * @param userId - User ID for scoping
   * @param options - Search options (topK, filters, etc.)
   * @returns Array of search results or error
   */
  async search(
    embedding: number[],
    userId: UserId,
    options?: VectorSearchOptions,
  ): Promise<Result<VectorSearchResult[], AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const indexName = this.dependencies.generateStandardIndexName(
      this.namespace,
      userId,
    );

    return this.dependencies.searchDocuments(
      clientResult.value,
      indexName,
      embedding,
      this.ctx.config,
      options,
    );
  }

  /**
   * Deletes a document from the vector store for a specific user.
   * @param id - Document ID
   * @param userId - User ID for scoping
   * @returns Success or error
   */
  async delete(
    id: VectorDocumentId,
    userId: UserId,
  ): Promise<Result<void, AppError>> {
    const clientResult = this.getClient();
    if (clientResult.isErr()) {
      return err(clientResult.error);
    }

    const key = this.dependencies.generateStandardVectorStoreKey(
      this.namespace,
      id,
      userId,
    );

    return this.dependencies.deleteDocument(clientResult.value, key);
  }
}
