/**
 * Agent cache module.
 *
 * Provides caching infrastructure for agent execution:
 * - AgentStateCache: Persists agent execution state during suspension
 * - AgentCancellationCache: Stores cancellation signals for cooperative cancellation
 *
 * @module agents/infrastructure/cache
 */

export {
  createAgentCancellationCache,
  type IAgentCancellationCache,
} from './AgentCancellationCache';
export {
  createAgentStateCache,
  type IAgentStateCache,
} from './AgentStateCache';
