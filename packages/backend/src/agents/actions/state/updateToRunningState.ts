import type {
  AgentRunOptions,
  AgentState,
  StateDeps,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import { type AppError, notFound } from '@core/errors';
import { err, type Result } from 'neverthrow';

export type UpdateToRunningStateDeps = StateDeps;

/**
 * Updates an existing agent state to 'running' status.
 *
 * Used when continuing an existing state (reply, approval, continue flows).
 * This transitions the state from its previous status (typically 'suspended'
 * or 'completed') to 'running' to indicate active execution.
 *
 * Also updates startedAt timestamp for crash detection - this is reset
 * on each continuation since each execution segment has its own duration.
 */
export async function updateToRunningState(
  ctx: Context,
  stateId: AgentRunId,
  deps: UpdateToRunningStateDeps,
  options?: AgentRunOptions,
): Promise<Result<void, AppError>> {
  const stateResult = await deps.stateCache.get(ctx, stateId);
  if (stateResult.isErr()) {
    return err(stateResult.error);
  }

  const state = stateResult.value;
  if (!state) {
    return err(notFound('Agent state not found', { metadata: { stateId } }));
  }

  const now = new Date();
  const updatedState: AgentState = {
    ...state,
    status: 'running',
    startedAt: now, // Reset for crash detection (each continuation has own duration)
    updatedAt: now,
  };

  return deps.stateCache.set(
    ctx,
    stateId,
    updatedState,
    options?.agentStateTtl,
  );
}
