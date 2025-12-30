import type {
  AgentRunId,
  ContinueResponse,
  Suspension,
  SuspensionStack,
  ToolApprovalSuspension,
} from '@core/domain/agents';
import type { AgentRunState } from '../AgentRunState';
import type { AgentState } from '../AgentState';
import type { ParentAgentContext } from '../ParentAgentContext';

/**
 * Result from prepare functions.
 *
 * Discriminated union with five variants:
 * - start: Fresh execution - CREATE new state (only for first request)
 * - continue: Continuing existing state - UPDATE to running (reply/approval/continue)
 * - delegate: Nested sub-agent suspension - delegate to resumeFromSuspensionStack
 * - suspended: Partial approval - still has pending suspensions, return early
 * - already-running: Agent is already executing - return early with status
 *
 * The prepare phase determines how to initialize agent state based on
 * the type of input (fresh request, reply, approval, or continue).
 */
export type PrepareResult =
  | {
      readonly type: 'start';
      readonly stateId: AgentRunId;
      readonly state: AgentRunState;
      readonly context?: Record<string, unknown>;
      readonly previousElapsedMs: number;
    }
  | {
      readonly type: 'continue';
      readonly stateId: AgentRunId;
      readonly state: AgentRunState;
      readonly context?: Record<string, unknown>;
      readonly previousElapsedMs: number;
      /** Parent context from saved state (for resume scenarios) */
      readonly parentContext?: ParentAgentContext;
      /** Suspensions that were resolved to trigger this resume */
      readonly resolvedSuspensions?: readonly Suspension[];
    }
  | {
      readonly type: 'delegate';
      readonly savedState: AgentState;
      readonly matchingStack: SuspensionStack;
      readonly response: ContinueResponse;
    }
  | {
      readonly type: 'suspended';
      readonly runId: AgentRunId;
      readonly remainingSuspensions: ToolApprovalSuspension[];
    }
  | {
      readonly type: 'already-running';
      readonly runId: AgentRunId;
    };
