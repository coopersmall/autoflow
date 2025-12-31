import type { LifecycleHook } from './LifecycleHook';
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
 * All return Result<void, AppError> - errors propagate to the caller.
 *
 * These hooks are chained using chainObservationHooks (sequential, first error aborts).
 *
 * IMPORTANT: ALL hooks (including terminal hooks like onAgentComplete, onAgentSuspend,
 * onAgentError, and onAgentCancelled) will propagate errors to the caller. If a terminal
 * hook fails:
 * - The agent state remains as-is (completed/suspended/etc.)
 * - The terminal event is NOT emitted
 * - The error is returned to the caller
 *
 * If your hook should never fail the run, handle errors internally and return ok(undefined).
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
  readonly onAgentStart?: LifecycleHook<AgentStartParams>;

  /**
   * Called when resuming from suspension.
   * Only called for resumes (not fresh starts).
   * Failure aborts the run.
   *
   * State exists in cache when this fires.
   */
  readonly onAgentResume?: LifecycleHook<AgentResumeParams>;

  /**
   * Called after agent completes successfully.
   * Failure propagates to the caller (terminal event NOT emitted).
   */
  readonly onAgentComplete?: LifecycleHook<AgentCompleteParams>;

  /**
   * Called after agent suspends (HITL).
   * Failure propagates to the caller (terminal event NOT emitted).
   */
  readonly onAgentSuspend?: LifecycleHook<AgentSuspendParams>;

  /**
   * Called after agent errors.
   * Failure propagates to the caller (terminal event NOT emitted).
   */
  readonly onAgentError?: LifecycleHook<AgentErrorParams>;

  /**
   * Called after agent is cancelled.
   * Failure propagates to the caller (terminal event NOT emitted).
   */
  readonly onAgentCancelled?: LifecycleHook<AgentCancelledParams>;
}
