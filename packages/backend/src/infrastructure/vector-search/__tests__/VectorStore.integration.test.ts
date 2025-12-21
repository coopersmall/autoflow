/**
 * SharedVectorStore Integration Tests
 *
 * Tests the SharedVectorStore with real Redis Stack (RediSearch).
 * Focuses on property-based testing for critical invariants:
 * - Data preservation through round-trips
 * - Search result ordering and filtering
 * - Document lifecycle (add/delete)
 */

import { describe, expect, it } from 'bun:test';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import * as fc from 'fast-check';
import { SharedVectorStore, type VectorDocumentId } from '../index';

describe('SharedVectorStore Integration Tests', () => {
  const { getConfig } = setupIntegrationTest();

  // Factory to create a fresh store for each test with unique namespace
  const createStore = (namespace?: string) => {
    const uniqueNamespace =
      namespace ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return new SharedVectorStore(uniqueNamespace, {
      appConfig: getConfig(),
      config: {
        vectorField: 'embedding',
        dimensions: 4,
        distanceMetric: 'COSINE',
        algorithm: 'FLAT',
        hnswM: 16,
        hnswEfConstruction: 200,
        hnswEfRuntime: 10,
        schemaFields: [
          { name: 'category', type: 'TAG' },
          { name: 'priority', type: 'NUMERIC' },
        ],
      },
    });
  };

  // Helper to create normalized embeddings (deterministic from seed)
  const createNormalizedEmbedding = (seed: number): number[] => {
    const raw = Array.from({ length: 4 }, (_, i) => Math.sin(seed * (i + 1)));
    const magnitude = Math.sqrt(raw.reduce((sum, v) => sum + v * v, 0));
    return raw.map((v) => v / magnitude);
  };

  // Arbitraries for property testing
  const docIdArb = fc.uuid().map((id) => id as VectorDocumentId);
  const contentArb = fc.string({ minLength: 1, maxLength: 500 });
  const categoryArb = fc.constantFrom('tech', 'science', 'art', 'news');
  const priorityArb = fc.integer({ min: 1, max: 10 });
  const topKArb = fc.integer({ min: 1, max: 20 });
  const docCountArb = fc.integer({ min: 2, max: 8 });
  const seedArb = fc.integer({ min: 1, max: 100 });

  describe('Property Tests', () => {
    it('should preserve document content through add/search round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          docIdArb,
          contentArb,
          categoryArb,
          priorityArb,
          seedArb,
          async (id, content, category, priority, seed) => {
            const store = createStore();
            const embedding = createNormalizedEmbedding(seed);

            // Add document
            const addResult = await store.add(id, {
              id,
              embedding,
              content,
              metadata: { category, priority },
            });
            expect(addResult.isOk()).toBe(true);

            // Search with same embedding (should find it)
            const searchResult = await store.search(embedding, { topK: 10 });
            expect(searchResult.isOk()).toBe(true);

            const results = searchResult._unsafeUnwrap();
            expect(results.length).toBeGreaterThan(0);

            // Find our document in results
            const foundDoc = results.find((r) => r.id === id);
            expect(foundDoc).toBeDefined();
            expect(foundDoc?.content).toBe(content);
            expect(foundDoc?.metadata?.category).toBe(category);
            expect(foundDoc?.metadata?.priority).toBe(priority);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should return documents ordered by ascending similarity score', async () => {
      await fc.assert(
        fc.asyncProperty(docCountArb, async (count) => {
          const store = createStore();
          const queryEmbedding = [1, 0, 0, 0]; // Fixed query vector

          // Add documents with varying similarity to query
          for (let i = 0; i < count; i++) {
            const id = `doc-${i}` as VectorDocumentId;
            // Vary first component to create different similarities
            const similarity = 1 - i * 0.1;
            const embedding = [similarity, 0, 0, 0];
            const magnitude = Math.sqrt(
              embedding.reduce((sum, v) => sum + v * v, 0),
            );
            const normalized = embedding.map((v) => v / magnitude);

            await store.add(id, {
              id,
              embedding: normalized,
              content: `Document ${i}`,
              metadata: {},
            });
          }

          // Search and verify ordering
          const searchResult = await store.search(queryEmbedding, {
            topK: count,
          });
          expect(searchResult.isOk()).toBe(true);

          const results = searchResult._unsafeUnwrap();

          // Scores should be in ascending order (lower = more similar)
          for (let i = 1; i < results.length; i++) {
            expect(results[i].score).toBeGreaterThanOrEqual(
              results[i - 1].score,
            );
          }
        }),
        { numRuns: 30 },
      );
    });

    it('should never return more than topK results', async () => {
      await fc.assert(
        fc.asyncProperty(docCountArb, topKArb, async (docCount, topK) => {
          const store = createStore();
          const queryEmbedding = createNormalizedEmbedding(42);

          // Add more documents than topK
          const totalDocs = Math.max(docCount, topK + 2);
          for (let i = 0; i < totalDocs; i++) {
            const id = `doc-${i}` as VectorDocumentId;
            const embedding = createNormalizedEmbedding(i + 1);
            await store.add(id, {
              id,
              embedding,
              content: `Document ${i}`,
              metadata: {},
            });
          }

          // Search with topK limit
          const searchResult = await store.search(queryEmbedding, { topK });
          expect(searchResult.isOk()).toBe(true);

          const results = searchResult._unsafeUnwrap();
          expect(results.length).toBeLessThanOrEqual(topK);
        }),
        { numRuns: 30 },
      );
    });

    it('should only return documents matching TAG filter', async () => {
      await fc.assert(
        fc.asyncProperty(
          docCountArb,
          categoryArb,
          async (count, filterCategory) => {
            const store = createStore();
            const queryEmbedding = createNormalizedEmbedding(42);

            // Add documents with various categories
            const categories = ['tech', 'science', 'art', 'news'];
            for (let i = 0; i < count; i++) {
              const id = `doc-${i}` as VectorDocumentId;
              const category = categories[i % categories.length];
              const embedding = createNormalizedEmbedding(i + 1);

              await store.add(id, {
                id,
                embedding,
                content: `Document ${i}`,
                metadata: { category, priority: 5 },
              });
            }

            // Search with TAG filter
            const searchResult = await store.search(queryEmbedding, {
              topK: 20,
              filter: { tag: { category: filterCategory } },
            });
            expect(searchResult.isOk()).toBe(true);

            const results = searchResult._unsafeUnwrap();

            // All results should match the filter
            for (const result of results) {
              expect(result.metadata?.category).toBe(filterCategory);
            }
          },
        ),
        { numRuns: 30 },
      );
    });

    it('should only return documents within NUMERIC range filter', async () => {
      await fc.assert(
        fc.asyncProperty(docCountArb, async (count) => {
          const store = createStore();
          const queryEmbedding = createNormalizedEmbedding(42);

          // Add documents with various priorities
          for (let i = 0; i < count; i++) {
            const id = `doc-${i}` as VectorDocumentId;
            const priority = (i % 10) + 1; // 1-10
            const embedding = createNormalizedEmbedding(i + 1);

            await store.add(id, {
              id,
              embedding,
              content: `Document ${i}`,
              metadata: { category: 'tech', priority },
            });
          }

          // Search with NUMERIC range filter (priority 3-7)
          const searchResult = await store.search(queryEmbedding, {
            topK: 20,
            filter: {
              numeric: {
                priority: {
                  min: 3,
                  max: 7,
                  minExclusive: false,
                  maxExclusive: false,
                },
              },
            },
          });
          expect(searchResult.isOk()).toBe(true);

          const results = searchResult._unsafeUnwrap();

          // All results should have priority within range
          for (const result of results) {
            const priority = result.metadata?.priority as number;
            expect(priority).toBeGreaterThanOrEqual(3);
            expect(priority).toBeLessThanOrEqual(7);
          }
        }),
        { numRuns: 30 },
      );
    });

    it('should not return deleted documents in search', async () => {
      await fc.assert(
        fc.asyncProperty(
          docIdArb,
          contentArb,
          seedArb,
          async (id, content, seed) => {
            const store = createStore();
            const embedding = createNormalizedEmbedding(seed);

            // Add document
            const addResult = await store.add(id, {
              id,
              embedding,
              content,
              metadata: {},
            });
            expect(addResult.isOk()).toBe(true);

            // Verify searchable
            const searchBefore = await store.search(embedding, { topK: 10 });
            expect(searchBefore.isOk()).toBe(true);
            const resultsBefore = searchBefore._unsafeUnwrap();
            expect(resultsBefore.some((r) => r.id === id)).toBe(true);

            // Delete document
            const deleteResult = await store.delete(id);
            expect(deleteResult.isOk()).toBe(true);

            // Search again - should not find deleted document
            const searchAfter = await store.search(embedding, { topK: 10 });
            expect(searchAfter.isOk()).toBe(true);
            const resultsAfter = searchAfter._unsafeUnwrap();
            expect(resultsAfter.some((r) => r.id === id)).toBe(false);
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should overwrite document when adding same ID twice (idempotent)', async () => {
      await fc.assert(
        fc.asyncProperty(
          docIdArb,
          contentArb,
          contentArb,
          seedArb,
          async (id, contentA, contentB, seed) => {
            // Skip if contents are the same (can't test overwrite)
            if (contentA === contentB) return;

            const store = createStore();
            const embedding = createNormalizedEmbedding(seed);

            // Add document with content A
            const add1 = await store.add(id, {
              id,
              embedding,
              content: contentA,
              metadata: {},
            });
            expect(add1.isOk()).toBe(true);

            // Add document with same ID, content B
            const add2 = await store.add(id, {
              id,
              embedding,
              content: contentB,
              metadata: {},
            });
            expect(add2.isOk()).toBe(true);

            // Search should return only one result with content B
            const searchResult = await store.search(embedding, { topK: 10 });
            expect(searchResult.isOk()).toBe(true);

            const results = searchResult._unsafeUnwrap();
            const matchingDocs = results.filter((r) => r.id === id);

            expect(matchingDocs.length).toBe(1);
            expect(matchingDocs[0].content).toBe(contentB);
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  describe('CRUD Operations', () => {
    it('should add a document successfully', async () => {
      const store = createStore();
      const docId = 'doc-1' as VectorDocumentId;
      const embedding = createNormalizedEmbedding(1);

      const result = await store.add(docId, {
        id: docId,
        embedding,
        content: 'Test document',
        metadata: { category: 'tech' },
      });

      expect(result.isOk()).toBe(true);
    });

    it('should delete a document successfully', async () => {
      const store = createStore();
      const docId = 'doc-1' as VectorDocumentId;
      const embedding = createNormalizedEmbedding(1);

      // Add then delete
      await store.add(docId, {
        id: docId,
        embedding,
        content: 'Test document',
        metadata: {},
      });

      const deleteResult = await store.delete(docId);
      expect(deleteResult.isOk()).toBe(true);
    });

    it('should handle deleting non-existent document gracefully', async () => {
      const store = createStore();
      const docId = 'non-existent' as VectorDocumentId;

      const deleteResult = await store.delete(docId);
      expect(deleteResult.isOk()).toBe(true); // Should succeed (idempotent)
    });
  });

  describe('Search Behavior', () => {
    it('should return empty results when no documents exist', async () => {
      const store = createStore();
      const queryEmbedding = createNormalizedEmbedding(42);

      const searchResult = await store.search(queryEmbedding, { topK: 10 });

      expect(searchResult.isOk()).toBe(true);
      const results = searchResult._unsafeUnwrap();
      expect(results).toEqual([]);
    });

    it('should auto-create index on first add', async () => {
      const store = createStore();
      const docId = 'doc-1' as VectorDocumentId;
      const embedding = createNormalizedEmbedding(1);

      // First add should create index automatically
      const addResult = await store.add(docId, {
        id: docId,
        embedding,
        content: 'First document',
        metadata: {},
      });

      expect(addResult.isOk()).toBe(true);

      // Should be able to search and find the document
      const searchResult = await store.search(embedding, { topK: 10 });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe(docId);
    });
  });

  describe('Error Handling', () => {
    it('should return error for invalid embedding dimensions', async () => {
      const store = createStore();
      const docId = 'doc-1' as VectorDocumentId;
      const invalidEmbedding = [1, 2, 3]; // 3D instead of 4D

      const result = await store.add(docId, {
        id: docId,
        embedding: invalidEmbedding,
        content: 'Test document',
        metadata: {},
      });

      // Should fail due to dimension mismatch
      expect(result.isErr()).toBe(true);
    });
  });

  describe('Algorithm Variations', () => {
    it('should work with HNSW algorithm and EF_RUNTIME parameter', async () => {
      await fc.assert(
        fc.asyncProperty(
          docIdArb,
          contentArb,
          seedArb,
          async (id, content, seed) => {
            // Create store with HNSW algorithm
            const hnswStore = new SharedVectorStore(
              `hnsw-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              {
                appConfig: getConfig(),
                config: {
                  vectorField: 'embedding',
                  dimensions: 4,
                  distanceMetric: 'COSINE',
                  algorithm: 'HNSW',
                  hnswM: 16,
                  hnswEfConstruction: 200,
                  hnswEfRuntime: 50, // Higher EF_RUNTIME for better accuracy
                  schemaFields: [{ name: 'category', type: 'TAG' }],
                },
              },
            );

            const embedding = createNormalizedEmbedding(seed);

            // Add document
            const addResult = await hnswStore.add(id, {
              id,
              embedding,
              content,
              metadata: { category: 'test' },
            });
            expect(addResult.isOk()).toBe(true);

            // Search should work with HNSW and find the document
            const searchResult = await hnswStore.search(embedding, {
              topK: 10,
            });
            expect(searchResult.isOk()).toBe(true);
            const results = searchResult._unsafeUnwrap();
            expect(results.length).toBeGreaterThan(0);
            expect(results[0].id).toBe(id);
            expect(results[0].content).toBe(content);
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should produce consistent results with FLAT algorithm', async () => {
      const flatStore = new SharedVectorStore(
        `flat-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        {
          appConfig: getConfig(),
          config: {
            vectorField: 'embedding',
            dimensions: 4,
            distanceMetric: 'COSINE',
            algorithm: 'FLAT',
            hnswM: 16,
            hnswEfConstruction: 200,
            hnswEfRuntime: 10,
            schemaFields: [],
          },
        },
      );

      // Add multiple documents
      const embeddings = [
        [1, 0, 0, 0],
        [0.9, 0.1, 0, 0],
        [0.8, 0.2, 0, 0],
      ];

      for (let i = 0; i < embeddings.length; i++) {
        await flatStore.add(`doc-${i}` as VectorDocumentId, {
          id: `doc-${i}` as VectorDocumentId,
          embedding: embeddings[i],
          content: `Document ${i}`,
          metadata: {},
        });
      }

      // FLAT algorithm should return exact nearest neighbors
      const queryEmbedding = [1, 0, 0, 0];
      const searchResult = await flatStore.search(queryEmbedding, { topK: 3 });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      expect(results.length).toBe(3);
      // First result should be exact match (distance ~0)
      expect(results[0].score).toBeLessThan(0.001);
    });
  });

  describe('Distance Metric Variations', () => {
    it('should work with L2 (Euclidean) distance metric', async () => {
      const l2Store = new SharedVectorStore(
        `l2-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        {
          appConfig: getConfig(),
          config: {
            vectorField: 'embedding',
            dimensions: 4,
            distanceMetric: 'L2',
            algorithm: 'FLAT',
            hnswM: 16,
            hnswEfConstruction: 200,
            hnswEfRuntime: 10,
            schemaFields: [],
          },
        },
      );

      const docId = 'doc-1' as VectorDocumentId;
      const embedding = [1, 2, 3, 4];

      await l2Store.add(docId, {
        id: docId,
        embedding,
        content: 'L2 test document',
        metadata: {},
      });

      // L2 distance: sqrt(sum((a-b)^2))
      // Same vector should have distance 0
      const searchResult = await l2Store.search(embedding, { topK: 10 });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBe(0); // Exact match has distance 0
    });

    it('should work with IP (Inner Product) distance metric', async () => {
      const ipStore = new SharedVectorStore(
        `ip-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        {
          appConfig: getConfig(),
          config: {
            vectorField: 'embedding',
            dimensions: 4,
            distanceMetric: 'IP',
            algorithm: 'FLAT',
            hnswM: 16,
            hnswEfConstruction: 200,
            hnswEfRuntime: 10,
            schemaFields: [],
          },
        },
      );

      const docId = 'doc-1' as VectorDocumentId;
      const embedding = [1, 1, 1, 1];

      await ipStore.add(docId, {
        id: docId,
        embedding,
        content: 'IP test document',
        metadata: {},
      });

      // IP distance: 1 - dot_product(a, b)
      // Same vector should have distance 0 (1 - dot_product(a,a) where dot_product = 4)
      const searchResult = await ipStore.search(embedding, { topK: 10 });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      expect(results.length).toBeGreaterThan(0);
      // IP score for identical vectors should be 0
      expect(results[0].score).toBeLessThan(0.001);
    });

    it('should rank documents correctly with different distance metrics', async () => {
      const cosineStore = new SharedVectorStore(
        `cosine-rank-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        {
          appConfig: getConfig(),
          config: {
            vectorField: 'embedding',
            dimensions: 4,
            distanceMetric: 'COSINE',
            algorithm: 'FLAT',
            hnswM: 16,
            hnswEfConstruction: 200,
            hnswEfRuntime: 10,
            schemaFields: [],
          },
        },
      );

      // Add documents with varying similarity
      const docs = [
        { id: 'exact' as VectorDocumentId, embedding: [1, 0, 0, 0] },
        { id: 'close' as VectorDocumentId, embedding: [0.95, 0.05, 0, 0] },
        { id: 'far' as VectorDocumentId, embedding: [0, 1, 0, 0] },
      ];

      for (const doc of docs) {
        await cosineStore.add(doc.id, {
          id: doc.id,
          embedding: doc.embedding,
          content: `Document ${doc.id}`,
          metadata: {},
        });
      }

      const queryEmbedding = [1, 0, 0, 0];
      const searchResult = await cosineStore.search(queryEmbedding, {
        topK: 3,
      });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      expect(results.length).toBe(3);

      // Results should be ordered by similarity (ascending distance)
      expect(results[0].id).toBe('exact' as VectorDocumentId);
      expect(results[1].id).toBe('close' as VectorDocumentId);
      expect(results[2].id).toBe('far' as VectorDocumentId);
    });
  });

  describe('Complex Filter Combinations', () => {
    it('should support combined TAG and NUMERIC filters', async () => {
      const store = createStore();
      const queryEmbedding = [1, 0, 0, 0];

      // Add documents with different categories and priorities
      const docs = [
        {
          id: 'doc-1',
          category: 'tech',
          priority: 5,
          embedding: [1, 0, 0, 0],
        },
        {
          id: 'doc-2',
          category: 'tech',
          priority: 8,
          embedding: [0.9, 0.1, 0, 0],
        },
        {
          id: 'doc-3',
          category: 'science',
          priority: 7,
          embedding: [0.8, 0.2, 0, 0],
        },
        {
          id: 'doc-4',
          category: 'tech',
          priority: 3,
          embedding: [0.7, 0.3, 0, 0],
        },
      ];

      for (const doc of docs) {
        await store.add(doc.id as VectorDocumentId, {
          id: doc.id as VectorDocumentId,
          embedding: doc.embedding,
          content: `Document ${doc.id}`,
          metadata: { category: doc.category, priority: doc.priority },
        });
      }

      // Search for tech documents with priority >= 5
      const searchResult = await store.search(queryEmbedding, {
        topK: 10,
        filter: {
          tag: { category: 'tech' },
          numeric: {
            priority: { min: 5, minExclusive: false, maxExclusive: false },
          },
        },
      });

      expect(searchResult.isOk()).toBe(true);
      const results = searchResult._unsafeUnwrap();

      // Should only return doc-1 and doc-2 (tech + priority >= 5)
      expect(results.length).toBe(2);
      const ids = results.map((r) => r.id);
      expect(ids).toContain('doc-1' as VectorDocumentId);
      expect(ids).toContain('doc-2' as VectorDocumentId);
      expect(ids).not.toContain('doc-3' as VectorDocumentId); // wrong category
      expect(ids).not.toContain('doc-4' as VectorDocumentId); // priority too low

      // Verify all results match filters
      for (const result of results) {
        expect(result.metadata?.category).toBe('tech');
        expect(result.metadata?.priority).toBeGreaterThanOrEqual(5);
      }
    });

    it('should support NUMERIC range with exclusive bounds', async () => {
      const store = createStore();
      const queryEmbedding = [1, 0, 0, 0];

      // Add documents with priorities 1-10
      for (let i = 1; i <= 10; i++) {
        await store.add(`doc-${i}` as VectorDocumentId, {
          id: `doc-${i}` as VectorDocumentId,
          embedding: createNormalizedEmbedding(i),
          content: `Document ${i}`,
          metadata: { priority: i },
        });
      }

      // Search for 3 < priority < 7 (exclusive bounds)
      const searchResult = await store.search(queryEmbedding, {
        topK: 10,
        filter: {
          numeric: {
            priority: {
              min: 3,
              max: 7,
              minExclusive: true,
              maxExclusive: true,
            },
          },
        },
      });

      expect(searchResult.isOk()).toBe(true);
      const results = searchResult._unsafeUnwrap();

      // Should return priorities 4, 5, 6 (3 documents)
      expect(results.length).toBe(3);

      for (const result of results) {
        const priority = result.metadata?.priority as number;
        expect(priority).toBeGreaterThan(3);
        expect(priority).toBeLessThan(7);
      }
    });

    it('should support NUMERIC range with mixed bounds', async () => {
      const store = createStore();
      const queryEmbedding = [1, 0, 0, 0];

      // Add documents with priorities 1-10
      for (let i = 1; i <= 10; i++) {
        await store.add(`doc-${i}` as VectorDocumentId, {
          id: `doc-${i}` as VectorDocumentId,
          embedding: createNormalizedEmbedding(i),
          content: `Document ${i}`,
          metadata: { priority: i },
        });
      }

      // Search for 5 <= priority < 8 (inclusive min, exclusive max)
      const searchResult = await store.search(queryEmbedding, {
        topK: 10,
        filter: {
          numeric: {
            priority: {
              min: 5,
              max: 8,
              minExclusive: false,
              maxExclusive: true,
            },
          },
        },
      });

      expect(searchResult.isOk()).toBe(true);
      const results = searchResult._unsafeUnwrap();

      // Should return priorities 5, 6, 7 (3 documents)
      expect(results.length).toBe(3);

      for (const result of results) {
        const priority = result.metadata?.priority as number;
        expect(priority).toBeGreaterThanOrEqual(5);
        expect(priority).toBeLessThan(8);
      }
    });
  });

  describe('Score Threshold Filtering', () => {
    it('should filter results by score threshold (property test)', async () => {
      await fc.assert(
        fc.asyncProperty(
          docCountArb,
          fc.double({ min: 0.1, max: 0.9, noNaN: true }), // threshold
          async (count, threshold) => {
            const store = createStore();
            const queryEmbedding = [1, 0, 0, 0];

            // Add documents with varying similarity
            for (let i = 0; i < count; i++) {
              const docId = `doc-${i}` as VectorDocumentId;
              const embedding = createNormalizedEmbedding(i + 1);

              await store.add(docId, {
                id: docId,
                embedding,
                content: `Document ${i}`,
                metadata: {},
              });
            }

            // Search with score threshold
            const searchResult = await store.search(queryEmbedding, {
              topK: count * 2, // Request more than we have
              scoreThreshold: threshold,
            });

            expect(searchResult.isOk()).toBe(true);
            const results = searchResult._unsafeUnwrap();

            // PROPERTY: All returned results must have score <= threshold
            for (const result of results) {
              expect(result.score).toBeLessThanOrEqual(threshold);
            }

            // PROPERTY: Results should still be ordered by score
            for (let i = 1; i < results.length; i++) {
              expect(results[i].score).toBeGreaterThanOrEqual(
                results[i - 1].score,
              );
            }
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Edge Cases and Special Characters', () => {
    it('should handle special characters in content', async () => {
      const store = createStore();
      const docId = 'special-doc' as VectorDocumentId;
      const embedding = [1, 0, 0, 0];

      // Content with special characters
      const specialContent =
        'Test with "quotes", \'apostrophes\', and symbols: @#$%^&*()!';

      const addResult = await store.add(docId, {
        id: docId,
        embedding,
        content: specialContent,
        metadata: {},
      });
      expect(addResult.isOk()).toBe(true);

      const searchResult = await store.search(embedding, { topK: 10 });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      const found = results.find((r) => r.id === docId);
      expect(found).toBeDefined();
      expect(found?.content).toBe(specialContent);
    });

    it('should handle unicode content', async () => {
      const store = createStore();
      const docId = 'unicode-doc' as VectorDocumentId;
      const embedding = [1, 0, 0, 0];

      // Unicode content
      const unicodeContent = 'Hello 世界 🌍 Привет مرحبا';

      const addResult = await store.add(docId, {
        id: docId,
        embedding,
        content: unicodeContent,
        metadata: {},
      });
      expect(addResult.isOk()).toBe(true);

      const searchResult = await store.search(embedding, { topK: 10 });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      const found = results.find((r) => r.id === docId);
      expect(found).toBeDefined();
      expect(found?.content).toBe(unicodeContent);
    });

    it('should handle empty string content', async () => {
      const store = createStore();
      const docId = 'empty-doc' as VectorDocumentId;
      const embedding = [1, 0, 0, 0];

      const addResult = await store.add(docId, {
        id: docId,
        embedding,
        content: '',
        metadata: {},
      });
      expect(addResult.isOk()).toBe(true);

      const searchResult = await store.search(embedding, { topK: 10 });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      const found = results.find((r) => r.id === docId);
      expect(found).toBeDefined();
      expect(found?.content).toBe('');
    });

    it('should handle very long content', async () => {
      const store = createStore();
      const docId = 'long-doc' as VectorDocumentId;
      const embedding = [1, 0, 0, 0];

      // Generate long content (10KB)
      const longContent = 'A'.repeat(10000);

      const addResult = await store.add(docId, {
        id: docId,
        embedding,
        content: longContent,
        metadata: {},
      });
      expect(addResult.isOk()).toBe(true);

      const searchResult = await store.search(embedding, { topK: 10 });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      const found = results.find((r) => r.id === docId);
      expect(found).toBeDefined();
      expect(found?.content).toBe(longContent);
    });

    it('should handle maximum topK values', async () => {
      const store = createStore();
      const queryEmbedding = [1, 0, 0, 0];

      // Add 50 documents
      for (let i = 0; i < 50; i++) {
        await store.add(`doc-${i}` as VectorDocumentId, {
          id: `doc-${i}` as VectorDocumentId,
          embedding: createNormalizedEmbedding(i + 1),
          content: `Document ${i}`,
          metadata: {},
        });
      }

      // Request large topK
      const searchResult = await store.search(queryEmbedding, { topK: 100 });
      expect(searchResult.isOk()).toBe(true);

      const results = searchResult._unsafeUnwrap();
      // Should return all 50 documents (not error on large topK)
      expect(results.length).toBe(50);
    });
  });
});
