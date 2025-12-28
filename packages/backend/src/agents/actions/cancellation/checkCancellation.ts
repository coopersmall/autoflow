import type { IAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';

export type CheckCancellationDeps = Readonly<{
  cancellationCache: IAgentCancellationCache;
}>;

/**
 * Checks if an agent run has been signaled for cancellation.
 * Also checks the context's abort signal for immediate cancellation.
 *
 * Returns true if cancellation signal exists or context is aborted.
 * On cache errors, returns false (fail-open to avoid blocking execution).
 */
export async function checkCancellation(
  ctx: Context,
  stateId: AgentRunId,
  deps: CheckCancellationDeps,
): Promise<Result<boolean, AppError>> {
  // Check context abort signal first (synchronous)
  if (ctx.signal.aborted) {
    return ok(true);
  }

  // Check cancellation cache
  const signalResult = await deps.cancellationCache.get(ctx, stateId);

  if (signalResult.isErr()) {
    // On cache error, don't cancel - continue execution
    return ok(false);
  }

  return ok(signalResult.value !== null);
}
