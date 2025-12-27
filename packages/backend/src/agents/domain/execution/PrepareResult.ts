import type {
  AgentRunId,
  ContinueResponse,
  Suspension,
  SuspensionStack,
} from '@core/domain/agents';
import type { AgentRunState } from '../AgentRunState';
import type { AgentState } from '../AgentState';

/**
 * Result from prepare functions.
 *
 * Discriminated union with three variants:
 * - ready: State prepared, continue to execution loop
 * - suspended: Partial resume, other branches still pending
 * - resume: Matched a suspension stack, needs resume handling
 *
 * The prepare phase determines how to initialize agent state based on
 * the type of input (fresh request, reply, approval, or continue).
 */
export type PrepareResult =
  | {
      readonly type: 'ready';
      readonly state: AgentRunState;
      readonly context?: Record<string, unknown>;
      readonly previousElapsedMs: number;
    }
  | {
      readonly type: 'suspended';
      readonly runId: AgentRunId;
      readonly remainingSuspensions: Suspension[];
      readonly context?: Record<string, unknown>;
    }
  | {
      readonly type: 'resume';
      readonly savedState: AgentState;
      readonly matchingStack: SuspensionStack;
      readonly response: ContinueResponse;
    };
