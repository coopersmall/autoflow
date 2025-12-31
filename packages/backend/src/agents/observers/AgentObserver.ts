import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { AgentManifestHooks } from '../hooks/AgentManifestHooks';
import type { AgentObserverContext } from './AgentObserverContext';

/**
 * A stateless observer factory that hooks into agent lifecycle for cross-cutting concerns.
 *
 * STATELESS DESIGN:
 * - Observers are pure factories that create hooks via `createHooks()`
 * - Each call to `createHooks()` returns self-contained hooks with their own closures
 * - No mutable state at the observer level - closures capture immutable init-time values
 * - When hooks are no longer referenced (run completes), closures are GC'd automatically
 * - NO cleanup methods required - no `getResult()`, no `runCompleted()`
 *
 * Observers are called BEFORE manifest hooks in the chain.
 * Observer errors can abort the run (return err() from lifecycle hooks).
 *
 * Common use cases:
 * - Conversation tracking (createConversationObserver)
 * - Metrics collection
 * - Audit logging
 * - State synchronization
 *
 * IMPORTANT: Create a fresh observer for each agent run.
 * Do not reuse observers across runs.
 */
export interface AgentObserver {
  /**
   * Creates hooks for this observer to register.
   * Called once per manifest when applying observers.
   *
   * The context provides information about the manifest's position
   * in the agent hierarchy (isRoot, parentManifestId).
   *
   * Returns hooks that capture any needed context via closure.
   * Each manifest gets its own set of closures for per-manifest state (e.g., startedAt).
   *
   * May be called multiple times (once per manifest in the run).
   *
   * @returns ok(hooks) on success, err() on failure
   */
  createHooks(
    context: AgentObserverContext,
  ): Result<Partial<AgentManifestHooks>, AppError>;
}
