import type { LifecycleHook } from './LifecycleHook';

// Note: These param types will be defined in Phase 5
// For now, we use placeholder interfaces that match the expected structure
import type {
  AgentCancelledParams,
  AgentCompleteParams,
  AgentErrorParams,
  AgentResumeParams,
  AgentStartParams,
  AgentSuspendParams,
} from './params';

/**
 * Agent lifecycle hooks - observe agent lifecycle events.
 * All return Result<void, AppError> - errors abort the run.
 *
 * These hooks are chained using chainObservationHooks (sequential, first error aborts).
 *
 * STATE GUARANTEE: When these hooks fire, the agent state EXISTS in the cache
 * and can be looked up by stateId. The state has status 'running'.
 */
export interface AgentLifecycleHooks {
  /**
   * Called after lock acquired and state created, before agent-started event.
   * Only called for fresh starts (not resumes).
   * Failure aborts the run.
   *
   * State exists in cache when this fires.
   */
  onAgentStart?: LifecycleHook<AgentStartParams>;

  /**
   * Called when resuming from suspension.
   * Only called for resumes (not fresh starts).
   * Failure aborts the run.
   *
   * State exists in cache when this fires.
   */
  onAgentResume?: LifecycleHook<AgentResumeParams>;

  /** Called after agent completes successfully. */
  onAgentComplete?: LifecycleHook<AgentCompleteParams>;

  /** Called after agent suspends (HITL). */
  onAgentSuspend?: LifecycleHook<AgentSuspendParams>;

  /** Called after agent errors. */
  onAgentError?: LifecycleHook<AgentErrorParams>;

  /** Called after agent is cancelled. */
  onAgentCancelled?: LifecycleHook<AgentCancelledParams>;
}
