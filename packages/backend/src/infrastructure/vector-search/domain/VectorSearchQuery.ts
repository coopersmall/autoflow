import { idSchema, newId } from '@autoflow/core';
import zod from 'zod';

/**
 * Branded ID type for vector documents.
 */
export type VectorDocumentId = zod.infer<typeof vectorDocumentIdSchema>;
export const VectorDocumentId = newId<VectorDocumentId>;
export const vectorDocumentIdSchema = idSchema.brand<'VectorDocument'>();

/**
 * Numeric range for filter queries.
 */
export const numericRangeSchema = zod.strictObject({
  min: zod.number().optional(),
  max: zod.number().optional(),
  minExclusive: zod.boolean().optional().default(false),
  maxExclusive: zod.boolean().optional().default(false),
});
export type NumericRange = zod.infer<typeof numericRangeSchema>;

/**
 * Typed filter for metadata queries.
 * Filters are applied BEFORE vector search in Redis (pre-filtering).
 */
export const vectorFilterSchema = zod.strictObject({
  // TAG field filters: @field:{value} or @field:{val1|val2}
  tag: zod
    .record(zod.string(), zod.union([zod.string(), zod.array(zod.string())]))
    .optional(),

  // NUMERIC field filters: @field:[min max]
  numeric: zod.record(zod.string(), numericRangeSchema).optional(),

  // TEXT field filters: @field:(query terms)
  text: zod.record(zod.string(), zod.string()).optional(),

  // Raw filter string for complex queries (escape hatch)
  raw: zod.string().optional(),
});
export type VectorFilter = zod.infer<typeof vectorFilterSchema>;

/**
 * Vector search options.
 */
export const vectorSearchOptionsSchema = zod.strictObject({
  topK: zod
    .number()
    .int()
    .positive()
    .default(10)
    .describe('Number of nearest neighbors to return'),
  filter: vectorFilterSchema
    .optional()
    .describe('Metadata filter to apply before vector search'),
  scoreThreshold: zod
    .number()
    .min(0)
    .max(2)
    .optional()
    .describe('Maximum distance threshold (lower = more similar)'),
  returnFields: zod
    .array(zod.string())
    .optional()
    .describe('Specific fields to return'),
});
export type VectorSearchOptions = zod.infer<typeof vectorSearchOptionsSchema>;

/**
 * Document to be indexed.
 * Uses branded VectorDocumentId for type safety.
 */
export const vectorDocumentSchema = zod.strictObject({
  id: zod
    .string()
    .describe('Unique document identifier (branded as VectorDocumentId)'),
  embedding: zod.array(zod.number()).describe('Vector embedding'),
  content: zod.string().describe('Primary text content'),
  metadata: zod
    .record(zod.string(), zod.unknown())
    .optional()
    .describe('Additional metadata fields'),
});
export type VectorDocument = Omit<
  zod.infer<typeof vectorDocumentSchema>,
  'id'
> & {
  id: VectorDocumentId;
};

/**
 * Search result item.
 * Uses branded VectorDocumentId for type safety.
 */
export const vectorSearchResultSchema = zod.strictObject({
  id: vectorDocumentIdSchema.describe('Unique document identifier'),
  score: zod.number().describe('Distance score (lower = more similar)'),
  content: zod.string().describe('Document content'),
  metadata: zod
    .record(zod.string(), zod.unknown())
    .optional()
    .describe('Document metadata'),
});
export type VectorSearchResult = zod.infer<typeof vectorSearchResultSchema>;
