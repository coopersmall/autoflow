/**
 * Utility for creating cached getters with lazy initialization.
 *
 * This pattern is useful for database connections, adapters, and other
 * expensive resources that should be initialized once and reused.
 *
 * The mutable state (cached result) is encapsulated in a closure,
 * allowing the consuming class to remain immutable and freezable.
 */

import type { Result } from 'neverthrow';

/**
 * Creates a getter function that initializes once and caches the result.
 *
 * @param initialize - Function that creates the resource (returns Result)
 * @returns Cached getter function that returns the same Result on subsequent calls
 *
 * @example
 * ```typescript
 * const getClient = createCachedGetter(() =>
 *   clientFactory.getDatabase('bun-sql', 'users')
 * );
 *
 * // First call initializes
 * const result1 = getClient();
 * // Subsequent calls return cached result
 * const result2 = getClient(); // Same instance
 * ```
 */
export function createCachedGetter<T, E>(
  initialize: () => Result<T, E>,
): () => Result<T, E> {
  let cached: Result<T, E> | undefined;

  return () => {
    if (!cached) {
      cached = initialize();
    }
    return cached;
  };
}
