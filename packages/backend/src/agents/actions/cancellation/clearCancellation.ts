import type { IAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export type ClearCancellationDeps = Readonly<{
  cancellationCache: IAgentCancellationCache;
}>;

/**
 * Clears the cancellation signal for an agent run.
 * Called after the agent has processed the cancellation or completed normally.
 */
export async function clearCancellation(
  ctx: Context,
  stateId: AgentRunId,
  deps: ClearCancellationDeps,
): Promise<Result<void, AppError>> {
  return deps.cancellationCache.del(ctx, stateId);
}
