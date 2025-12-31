import type { IAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export type SignalCancellationDeps = Readonly<{
  cancellationCache: IAgentCancellationCache;
}>;

export type SignalCancellationOptions = Readonly<{
  reason?: string;
}>;

/**
 * Signals that an agent run should be cancelled.
 * The running agent will detect this on its next cancellation check
 * or via the polling wrapper aborting its context.
 */
export async function signalCancellation(
  ctx: Context,
  stateId: AgentRunId,
  deps: SignalCancellationDeps,
  options?: SignalCancellationOptions,
): Promise<Result<void, AppError>> {
  const now = new Date();
  return deps.cancellationCache.set(ctx, stateId, {
    // Item<ID> required fields
    id: stateId,
    createdAt: now,
    schemaVersion: 1,
    // Cancellation-specific fields
    cancelledAt: now,
    reason: options?.reason,
  });
}
