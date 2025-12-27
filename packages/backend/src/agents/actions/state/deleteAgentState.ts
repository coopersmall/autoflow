import type { StateDeps } from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, type Result } from 'neverthrow';
import { getAgentState } from './getAgentState';

export interface DeleteAgentStateOptions {
  /**
   * If true, recursively deletes all child states.
   * Uses state.childStateIds to traverse the tree.
   */
  readonly recursive?: boolean;
}

/**
 * Deletes agent state from cache.
 * Optionally recursively deletes all child states.
 *
 * Returns error if state cannot be deleted or if recursive
 * deletion fails on any child.
 *
 * Caller is responsible for:
 * - Deciding whether to use recursive deletion
 * - Logging success/errors
 */
export async function deleteAgentState(
  ctx: Context,
  stateId: AgentRunId,
  options: DeleteAgentStateOptions,
  deps: StateDeps,
): Promise<Result<void, AppError>> {
  // If recursive, load state to get child IDs
  if (options.recursive) {
    const stateResult = await getAgentState(ctx, stateId, deps);
    if (stateResult.isErr()) {
      return err(stateResult.error);
    }

    const state = stateResult.value;

    // If state exists, recursively delete children first
    if (state) {
      for (const childId of state.childStateIds) {
        const deleteResult = await deleteAgentState(
          ctx,
          childId,
          { recursive: true },
          deps,
        );
        if (deleteResult.isErr()) {
          return deleteResult;
        }
      }
    }
  }

  // Delete this state
  return deps.stateCache.del(ctx, stateId);
}
