import type { AgentState, StateDeps } from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';

/**
 * Loads agent state from cache.
 * Returns null if not found (not an error).
 *
 * Caller is responsible for:
 * - Handling null case (state not found)
 * - Logging success/errors
 */
export async function getAgentState(
  ctx: Context,
  stateId: AgentRunId,
  deps: StateDeps,
): Promise<Result<AgentState | null, AppError>> {
  const stateResult = await deps.stateCache.get(ctx, stateId);
  if (stateResult.isErr()) {
    return stateResult;
  }

  return ok(stateResult.value ?? null);
}
