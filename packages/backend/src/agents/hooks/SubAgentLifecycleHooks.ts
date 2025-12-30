import type { LifecycleHook } from './LifecycleHook';
import type {
  SubAgentCancelledParams,
  SubAgentCompleteParams,
  SubAgentErrorParams,
  SubAgentStartParams,
  SubAgentSuspendParams,
} from './params';

/**
 * Sub-agent lifecycle hooks - called on the PARENT manifest when child events occur.
 * All return Result<void, AppError> - errors fail the tool call.
 *
 * STATE GUARANTEE: When these hooks fire, BOTH parent and child states exist
 * in the cache. The child state has status 'running'.
 */
export interface SubAgentLifecycleHooks {
  /**
   * Called when a sub-agent starts.
   * Fired AFTER receiving agent-started event (child state exists).
   */
  onSubAgentStart?: LifecycleHook<SubAgentStartParams>;

  /** Called when a sub-agent completes successfully. */
  onSubAgentComplete?: LifecycleHook<SubAgentCompleteParams>;

  /** Called when a sub-agent suspends. */
  onSubAgentSuspend?: LifecycleHook<SubAgentSuspendParams>;

  /** Called when a sub-agent errors. */
  onSubAgentError?: LifecycleHook<SubAgentErrorParams>;

  /** Called when a sub-agent is cancelled. */
  onSubAgentCancelled?: LifecycleHook<SubAgentCancelledParams>;
}
