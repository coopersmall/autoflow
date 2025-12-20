import type { UserId } from '@core/domain/user/user';
import type { VectorDocumentId } from '../domain/VectorSearchQuery';

/**
 * Generates a key for shared (global) vector stores.
 * Format: {namespace}/{id}
 */
export function generateSharedVectorStoreKey(
  namespace: string,
  id: VectorDocumentId,
): string {
  return `${namespace}/${id}`;
}

/**
 * Generates a key for user-scoped vector stores.
 * Format: user/{userId}/{namespace}/{id}
 */
export function generateStandardVectorStoreKey(
  namespace: string,
  id: VectorDocumentId,
  userId: UserId,
): string {
  return `user/${userId}/${namespace}/${id}`;
}

/**
 * Generates an index name for shared vector stores.
 * Format: {namespace}:idx
 *
 * Note: Index names use `:` separator (Redis convention for index naming)
 * while document keys use `/` separator (consistent with cache layer).
 */
export function generateSharedIndexName(namespace: string): string {
  return `${namespace}:idx`;
}

/**
 * Generates an index name for user-scoped vector stores.
 * Format: user:{userId}:{namespace}:idx
 */
export function generateStandardIndexName(
  namespace: string,
  userId: UserId,
): string {
  return `user:${userId}:${namespace}:idx`;
}

/**
 * Generates the key prefix for a shared index.
 * Must match the pattern used in key generation.
 */
export function generateSharedKeyPrefix(namespace: string): string {
  return `${namespace}/`;
}

/**
 * Generates the key prefix for a user-scoped index.
 * Must match the pattern used in key generation.
 */
export function generateStandardKeyPrefix(
  namespace: string,
  userId: UserId,
): string {
  return `user/${userId}/${namespace}/`;
}
