import type { AgentState, StateDeps } from '@backend/agents/domain';
import { DEFAULT_AGENT_RUN_LOCK_TTL } from '@backend/agents/domain';
import type { IAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import type { IAgentRunLock } from '@backend/agents/infrastructure/lock';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import { type AppError, badRequest, notFound } from '@core/errors';
import { err, ok, type Result } from 'neverthrow';
import { signalCancellation } from '../cancellation';
import { extractChildStateIdsFromStacks } from './extractChildStateIdsFromStacks';
import { getAgentState } from './getAgentState';
import { updateAgentState } from './updateAgentState';

export interface CancelAgentStateDeps extends StateDeps {
  readonly cancellationCache: IAgentCancellationCache;
  readonly agentRunLock: IAgentRunLock;
}

export type CancelAgentStateOptions = Readonly<{
  recursive?: boolean;
  reason?: string;
  agentRunLockTtl?: number;
}>;

/**
 * Result of cancellation attempt.
 *
 * - `marked-cancelled`: Suspended agent was marked as cancelled
 * - `marked-failed`: Running agent was detected as crashed and marked as failed
 * - `signaled-running`: Running agent confirmed via lock, cancellation signal sent
 * - `already-cancelled`: Agent was already in cancelled state
 */
export type CancelResult =
  | { type: 'marked-cancelled'; stateId: AgentRunId }
  | { type: 'marked-failed'; stateId: AgentRunId }
  | { type: 'signaled-running'; stateId: AgentRunId }
  | { type: 'already-cancelled'; stateId: AgentRunId };

/**
 * Cancels an agent run.
 *
 * For suspended agents: Marks the state as cancelled directly.
 * For running agents: Signals cancellation via cache for the polling wrapper to detect.
 *
 * Uses lock-based verification to determine if an agent is truly running or has crashed.
 */
export async function cancelAgentState(
  ctx: Context,
  stateId: AgentRunId,
  deps: CancelAgentStateDeps,
  options?: CancelAgentStateOptions,
): Promise<Result<CancelResult, AppError>> {
  const stateResult = await getAgentState(ctx, stateId, deps);
  if (stateResult.isErr()) {
    return err(stateResult.error);
  }

  const state = stateResult.value;
  if (!state) {
    return err(notFound('Agent state not found', { metadata: { stateId } }));
  }

  switch (state.status) {
    case 'cancelled':
      return ok({ type: 'already-cancelled', stateId });

    case 'completed':
    case 'failed':
      return err(
        badRequest(`Cannot cancel agent in terminal state: ${state.status}`, {
          metadata: { stateId, status: state.status },
        }),
      );

    case 'running':
      return handleRunningCancellation(ctx, stateId, state, deps, options);

    case 'suspended':
      return handleSuspendedCancellation(ctx, stateId, state, deps, options);
  }
}

/**
 * Handle cancellation of a running agent using lock-based verification.
 *
 * Uses the distributed lock to verify the agent is actually running:
 * - If lock acquired: Agent is NOT running (finished or crashed) - handle appropriately
 * - If lock NOT acquired: Agent IS running - signal cancellation via polling
 *
 * Crash detection uses duration-based logic:
 * - If execution duration > lock TTL and we acquired the lock, the agent definitely crashed
 * - If execution duration <= lock TTL, might be a race condition - signal cancellation anyway
 */
async function handleRunningCancellation(
  ctx: Context,
  stateId: AgentRunId,
  state: AgentState,
  deps: CancelAgentStateDeps,
  options?: CancelAgentStateOptions,
): Promise<Result<CancelResult, AppError>> {
  // Try to acquire the lock to verify agent is actually running
  const lockResult = await deps.agentRunLock.acquire(ctx, stateId);

  if (lockResult.isErr()) {
    return err(lockResult.error);
  }

  const handle = lockResult.value;

  if (handle !== null) {
    // We got the lock! Agent is NOT actually running anymore.
    // It finished between status check and lock acquisition.
    try {
      // Reload state to see what actually happened
      const freshStateResult = await getAgentState(ctx, stateId, deps);
      if (freshStateResult.isErr()) {
        return err(freshStateResult.error);
      }

      const freshState = freshStateResult.value;
      if (!freshState) {
        return err(
          notFound('Agent state not found', { metadata: { stateId } }),
        );
      }

      // Handle based on actual current status
      switch (freshState.status) {
        case 'completed':
        case 'failed':
          return err(
            badRequest(
              `Cannot cancel agent that has already ${freshState.status}`,
              { metadata: { stateId, status: freshState.status } },
            ),
          );

        case 'cancelled':
          return ok({ type: 'already-cancelled', stateId });

        case 'suspended':
          // Agent suspended between our checks - use suspended handler
          return handleSuspendedCancellation(
            ctx,
            stateId,
            freshState,
            deps,
            options,
          );

        case 'running': {
          // State says running but we got the lock.
          // Use duration-based crash detection.
          const lockTtlMs =
            (options?.agentRunLockTtl ?? DEFAULT_AGENT_RUN_LOCK_TTL) * 1000;
          const startedAt = freshState.startedAt ?? freshState.createdAt;
          const executionDuration = Date.now() - startedAt.getTime();

          if (executionDuration > lockTtlMs) {
            // Execution exceeded lock TTL - definitely crashed
            // The lock should have been held but expired, meaning agent died
            const crashedState: AgentState = {
              ...freshState,
              status: 'failed',
              updatedAt: new Date(),
            };
            const updateResult = await updateAgentState(
              ctx,
              stateId,
              crashedState,
              deps,
            );
            if (updateResult.isErr()) {
              return err(updateResult.error);
            }
            return ok({ type: 'marked-failed', stateId });
          }

          // Started recently - might be race condition
          // Signal cancellation anyway - if truly running elsewhere, it will pick it up
          const signalResult = await signalCancellation(ctx, stateId, deps, {
            reason: options?.reason,
          });
          if (signalResult.isErr()) {
            return err(signalResult.error);
          }
          return ok({ type: 'signaled-running', stateId });
        }
      }
    } finally {
      await handle.release();
    }
  }

  // Lock NOT acquired - agent is actually running
  // Signal cancellation - agent will pick it up via polling
  const signalResult = await signalCancellation(ctx, stateId, deps, {
    reason: options?.reason,
  });
  if (signalResult.isErr()) {
    return err(signalResult.error);
  }
  return ok({ type: 'signaled-running', stateId });
}

/**
 * Handle cancellation of a suspended agent.
 *
 * Extracts child state IDs from suspension stacks (not childStateIds field)
 * and recursively cancels children before marking this state as cancelled.
 *
 * Re-verifies state before updating to handle TOCTOU race conditions where
 * the agent may have transitioned to a different state between initial check
 * and cancellation.
 */
async function handleSuspendedCancellation(
  ctx: Context,
  stateId: AgentRunId,
  state: AgentState,
  deps: CancelAgentStateDeps,
  options?: CancelAgentStateOptions,
): Promise<Result<CancelResult, AppError>> {
  // Extract child state IDs from suspension stacks
  const childStateIds = extractChildStateIdsFromStacks(state);

  // Recursively cancel children first (if any)
  if (options?.recursive && childStateIds.length > 0) {
    await Promise.allSettled(
      childStateIds.map((childId) =>
        cancelAgentState(ctx, childId, deps, options),
      ),
    );
  }

  // Re-verify state before updating (TOCTOU protection)
  // State may have changed during recursive child cancellation
  const freshStateResult = await getAgentState(ctx, stateId, deps);
  if (freshStateResult.isErr()) {
    return err(freshStateResult.error);
  }

  const freshState = freshStateResult.value;
  if (!freshState) {
    return err(notFound('Agent state not found', { metadata: { stateId } }));
  }

  // Handle state transitions that occurred during child cancellation
  switch (freshState.status) {
    case 'cancelled':
      return ok({ type: 'already-cancelled', stateId });

    case 'completed':
    case 'failed':
      return err(
        badRequest(
          `Cannot cancel agent that has already ${freshState.status}`,
          { metadata: { stateId, status: freshState.status } },
        ),
      );

    case 'running':
      // Agent resumed while we were cancelling children - delegate to running handler
      return handleRunningCancellation(ctx, stateId, freshState, deps, options);

    case 'suspended':
      // Still suspended - proceed with cancellation
      break;
  }

  // Mark this state as cancelled
  const updatedState: AgentState = {
    ...freshState,
    status: 'cancelled',
    updatedAt: new Date(),
  };

  const updateResult = await updateAgentState(ctx, stateId, updatedState, deps);
  if (updateResult.isErr()) {
    return err(updateResult.error);
  }

  return ok({ type: 'marked-cancelled', stateId });
}
