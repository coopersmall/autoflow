import type { AgentResult, ToolApprovalSuspension } from '@core/domain/agents';
import type { RequestToolResultPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import type { AgentRunState } from '../AgentRunState';
import type { SuspendedBranch } from './SuspendedBranch';

/**
 * Result from agent execution loop.
 *
 * Used by:
 * - executeAgentLoop (non-streaming)
 * - streamAgentLoop (streaming)
 * - unifiedAgentLoop (internal)
 *
 * Consolidates three previously identical types:
 * - AgentLoopResult
 * - StreamAgentLoopResult
 * - UnifiedLoopResult
 */
export type LoopResult =
  | { status: 'complete'; result: AgentResult; finalState: AgentRunState }
  | {
      status: 'suspended';
      suspensions: ToolApprovalSuspension[];
      subAgentBranches: SuspendedBranch[];
      completedToolResults: RequestToolResultPart[];
      finalState: AgentRunState;
    }
  | { status: 'error'; error: AppError; finalState: AgentRunState };
