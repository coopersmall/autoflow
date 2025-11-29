/**
 * Cache key generation utilities.
 *
 * Provides consistent key generation for both shared and user-scoped caches.
 * Keys follow these patterns:
 * - Shared: `{namespace}/{id}`
 * - Standard: `user/{userId}/{namespace}/{id}`
 */
import type { Id } from '@core/domain/Id';
import type { UserId } from '@core/domain/user/user';

/**
 * Generates a cache key with optional user scoping.
 * Delegates to either generateSharedCacheKey or generateStandardCacheKey.
 *
 * @param namespace - Cache namespace
 * @param id - Entity ID
 * @param userId - Optional user ID for scoping
 * @returns Formatted cache key
 */
export function generateCacheKey<ID extends Id<string> = Id<string>>(
  namespace: string,
  id: ID,
  userId?: UserId,
): string {
  if (userId && userId !== '') {
    return generateStandardCacheKey(namespace, id, userId);
  }
  return generateSharedCacheKey(namespace, id);
}

/**
 * Generates a cache key for shared (global) data.
 * Format: `{namespace}/{id}`
 *
 * @param namespace - Cache namespace (e.g., 'users', 'integrations')
 * @param id - Entity ID
 * @returns Formatted cache key
 */
export function generateSharedCacheKey<ID extends Id<string> = Id<string>>(
  namespace: string,
  id: ID,
): string {
  return `${namespace}/${id}`;
}

/**
 * Generates a cache key for user-scoped (standard) data.
 * Format: `user/{userId}/{namespace}/{id}`
 *
 * @param namespace - Cache namespace (e.g., 'integrations', 'secrets')
 * @param id - Entity ID
 * @param userId - User ID for scoping
 * @returns Formatted cache key
 */
export function generateStandardCacheKey<ID extends Id<string> = Id<string>>(
  namespace: string,
  id: ID,
  userId: UserId,
): string {
  return `user/${userId}/${namespace}/${id}`;
}
