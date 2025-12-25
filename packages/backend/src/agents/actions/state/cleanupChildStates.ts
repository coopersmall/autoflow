import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { AgentStateId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';
import type { IAgentStateCache } from '../../cache/AgentStateCache';

export interface CleanupChildStatesDeps {
  readonly stateCache: IAgentStateCache;
  readonly logger: ILogger;
}

/**
 * Recursively delete all child states when a parent completes or is cancelled.
 * Uses the childStateIds array stored in each state.
 *
 * This action is called on:
 * - Agent completion (status: 'completed')
 * - Agent cancellation (status: 'cancelled')
 * - Agent failure (status: 'failed')
 */
export async function cleanupChildStates(
  ctx: Context,
  stateId: AgentStateId,
  deps: CleanupChildStatesDeps,
): Promise<Result<void, AppError>> {
  const stateResult = await deps.stateCache.get(ctx, stateId);
  if (stateResult.isErr()) {
    // State may have already been cleaned up or expired
    deps.logger.debug('State not found during cleanup', { stateId });
    return ok(undefined);
  }

  const state = stateResult.value;

  // Recursively cleanup children first
  for (const childId of state.childStateIds) {
    await cleanupChildStates(ctx, childId, deps);
  }

  // Delete this state
  await deps.stateCache.del(ctx, stateId);

  return ok(undefined);
}
