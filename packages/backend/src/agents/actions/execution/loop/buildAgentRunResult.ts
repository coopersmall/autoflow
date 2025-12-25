import type { AgentRunId, AgentRunResult } from '@core/domain/agents';
import { unreachable } from '@core/unreachable';
import { ok, type Result } from 'neverthrow';
import type { AgentLoopResult } from './executeAgentLoop';

/**
 * Builds the final AgentRunResult from the loop result and saved state ID.
 *
 * Transforms the internal AgentLoopResult into the public-facing AgentRunResult
 * by attaching the runId to each status variant.
 */
export function buildAgentRunResult(
  loopResult: AgentLoopResult,
  runId: AgentRunId,
): Result<AgentRunResult, never> {
  switch (loopResult.status) {
    case 'complete':
      return ok({
        status: 'complete',
        result: loopResult.result,
        runId,
      });

    case 'suspended':
      return ok({
        status: 'suspended',
        suspensions: loopResult.suspensions,
        runId,
      });

    case 'error':
      return ok({
        status: 'error',
        error: loopResult.error,
        runId,
      });

    default:
      return unreachable(loopResult);
  }
}
