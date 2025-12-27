import type {
  AgentRunOptions,
  AgentState,
  StateDeps,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

/**
 * Updates existing agent state in cache.
 *
 * IMPORTANT: This performs a direct save without loading.
 * If you need to merge with existing state:
 * 1. Call getAgentState() first
 * 2. Merge your changes
 * 3. Call updateAgentState() with merged state
 *
 * Caller is responsible for:
 * - Loading existing state if merge is needed
 * - Setting updatedAt timestamp
 * - Logging success/errors
 */
export async function updateAgentState(
  ctx: Context,
  stateId: AgentRunId,
  state: AgentState,
  deps: StateDeps,
  options?: AgentRunOptions,
): Promise<Result<void, AppError>> {
  return deps.stateCache.set(ctx, stateId, state, options?.agentStateTtl);
}
