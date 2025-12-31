import type { AgentManifest } from '@backend/agents/domain';
import type { LoopResult } from '@backend/agents/domain/execution';
import type { AgentRunId, AgentRunResult } from '@core/domain/agents';
import { unreachable } from '@core/unreachable';
import { ok, type Result } from 'neverthrow';
import { buildSuspensionStacks } from './buildSuspensionStacks';

/**
 * Builds the final AgentRunResult from the loop result and saved state ID.
 *
 * Transforms the internal LoopResult into the public-facing AgentRunResult
 * by attaching the runId to each status variant and building suspension stacks
 * for sub-agent suspensions.
 */
export function buildAgentRunResult(
  loopResult: LoopResult,
  runId: AgentRunId,
  manifest: AgentManifest,
): Result<AgentRunResult, never> {
  switch (loopResult.status) {
    case 'complete':
      return ok({
        status: 'complete',
        result: loopResult.result,
        runId,
      });

    case 'suspended': {
      // Combine current agent's suspensions with flat list from sub-agent branches
      const allSuspensions = [
        ...loopResult.suspensions,
        ...loopResult.subAgentBranches.flatMap((b) => b.suspensions),
      ];

      // Build stacks for sub-agent suspensions
      const stacks =
        loopResult.subAgentBranches.length > 0
          ? buildSuspensionStacks({
              manifest,
              stateId: runId,
              branches: loopResult.subAgentBranches,
            })
          : [];

      return ok({
        status: 'suspended',
        suspensions: allSuspensions,
        suspensionStacks: stacks,
        runId,
      });
    }

    case 'error':
      return ok({
        status: 'error',
        error: loopResult.error,
        runId,
      });

    case 'cancelled':
      return ok({
        status: 'cancelled',
        runId,
      });

    default:
      return unreachable(loopResult);
  }
}
