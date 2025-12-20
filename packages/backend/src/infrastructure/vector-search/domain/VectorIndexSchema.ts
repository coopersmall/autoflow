import zod from 'zod';

/**
 * Supported field types for metadata indexing in Redis.
 * - TEXT: Full-text searchable field
 * - TAG: Exact match field (categories, labels)
 * - NUMERIC: Numeric range queries
 * - GEO: Geospatial queries
 */
export const schemaFieldTypeSchema = zod.enum([
  'TEXT',
  'TAG',
  'NUMERIC',
  'GEO',
]);
export type SchemaFieldType = zod.infer<typeof schemaFieldTypeSchema>;

/**
 * Schema field definition for metadata indexing.
 */
export const schemaFieldSchema = zod.strictObject({
  name: zod.string().describe('Field name in the document'),
  type: schemaFieldTypeSchema.describe('Redis field type'),
  sortable: zod
    .boolean()
    .optional()
    .describe('Enable sorting (NUMERIC/TAG only)'),
  noIndex: zod.boolean().optional().describe('Store but do not index'),
});
export type SchemaField = zod.infer<typeof schemaFieldSchema>;

/**
 * Supported vector index algorithms.
 * - FLAT: Brute force, exact results, best for <1M vectors
 * - HNSW: Approximate, faster for large datasets
 */
export const vectorAlgorithmSchema = zod.enum(['FLAT', 'HNSW']);
export type VectorAlgorithm = zod.infer<typeof vectorAlgorithmSchema>;

/**
 * Supported distance metrics.
 * - COSINE: Cosine similarity (most common for embeddings)
 * - L2: Euclidean distance
 * - IP: Inner product
 */
export const distanceMetricSchema = zod.enum(['COSINE', 'L2', 'IP']);
export type DistanceMetric = zod.infer<typeof distanceMetricSchema>;

/**
 * Vector index configuration.
 */
export const vectorIndexConfigSchema = zod.strictObject({
  // Vector field configuration
  vectorField: zod
    .string()
    .optional()
    .default('embedding')
    .describe('Name of the vector field'),
  dimensions: zod
    .number()
    .int()
    .positive()
    .describe('Vector dimensions (e.g., 1536 for OpenAI)'),
  distanceMetric: distanceMetricSchema
    .optional()
    .default('COSINE')
    .describe('Distance metric for similarity'),
  algorithm: vectorAlgorithmSchema
    .optional()
    .default('HNSW')
    .describe('Index algorithm'),

  // HNSW-specific parameters
  hnswM: zod
    .number()
    .int()
    .positive()
    .optional()
    .default(16)
    .describe('Max outgoing edges per node'),
  hnswEfConstruction: zod
    .number()
    .int()
    .positive()
    .optional()
    .default(200)
    .describe('Max neighbors during graph building'),
  hnswEfRuntime: zod
    .number()
    .int()
    .positive()
    .optional()
    .default(10)
    .describe('Max candidates during search'),

  // Metadata schema fields
  schemaFields: zod
    .array(schemaFieldSchema)
    .optional()
    .default([])
    .describe('Additional fields to index for filtering'),

  // TTL for documents (optional)
  ttlSeconds: zod
    .number()
    .int()
    .positive()
    .optional()
    .describe('TTL for documents in seconds'),
});
export type VectorIndexConfig = zod.infer<typeof vectorIndexConfigSchema>;
