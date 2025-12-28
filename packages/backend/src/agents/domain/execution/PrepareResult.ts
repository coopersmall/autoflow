import type {
  AgentRunId,
  ContinueResponse,
  SuspensionStack,
  ToolApprovalSuspension,
} from '@core/domain/agents';
import type { AgentRunState } from '../AgentRunState';
import type { AgentState } from '../AgentState';

/**
 * Result from prepare functions.
 *
 * Discriminated union with four variants:
 * - start: Fresh execution - CREATE new state (only for first request)
 * - continue: Continuing existing state - UPDATE to running (reply/approval/continue)
 * - delegate: Nested sub-agent suspension - delegate to resumeFromSuspensionStack
 * - suspended: Partial approval - still has pending suspensions, return early
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
    };
