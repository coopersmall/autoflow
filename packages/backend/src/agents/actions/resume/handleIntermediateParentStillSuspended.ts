import type {
  AgentRunOptions,
  AgentState,
  StateDeps,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentRunResult,
  SuspensionStack,
  SuspensionStackEntry,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { updateAgentState } from '../state';

/**
 * Handles when an intermediate parent remains suspended after receiving a tool result.
 * Re-roots the parent's suspension stacks to include the full path from root and updates root state.
 */
export async function handleIntermediateParentStillSuspended(
  ctx: Context,
  savedState: AgentState,
  matchingStack: SuspensionStack,
  pathToParent: SuspensionStackEntry[],
  parentEntry: SuspensionStackEntry,
  updatedParentState: AgentState,
  deps: StateDeps,
  options?: AgentRunOptions,
): Promise<Result<AgentRunResult, AppError>> {
  // Re-root parent's existing suspension stacks to include full path from root
  const reRootedStacks = updatedParentState.suspensionStacks.map((stack) => ({
    agents: [...pathToParent, ...stack.agents],
    leafSuspension: stack.leafSuspension,
  }));

  // Build stacks for parent's own HITL suspensions (not covered by any stack)
  const stackedApprovalIds = new Set(
    updatedParentState.suspensionStacks.map((s) => s.leafSuspension.approvalId),
  );

  const parentOwnSuspensionStacks = updatedParentState.suspensions
    .filter((s) => !stackedApprovalIds.has(s.approvalId))
    .map((suspension) => ({
      agents: [
        ...pathToParent,
        {
          manifestId: parentEntry.manifestId,
          manifestVersion: parentEntry.manifestVersion,
          stateId: parentEntry.stateId,
          pendingToolCallId: undefined, // Leaf has no pending tool call
        },
      ],
      leafSuspension: suspension,
    }));

  const allReRootedStacks = [...reRootedStacks, ...parentOwnSuspensionStacks];

  // Update root state to reflect the completed stack and new re-rooted stacks
  const remainingRootStacks = savedState.suspensionStacks.filter(
    (s) =>
      s.leafSuspension.approvalId !== matchingStack.leafSuspension.approvalId,
  );

  const updatedRootState: AgentState = {
    ...savedState,
    suspensionStacks: [...remainingRootStacks, ...allReRootedStacks],
    updatedAt: new Date(),
  };

  const updateResult = await updateAgentState(
    ctx,
    savedState.id,
    updatedRootState,
    deps,
    options,
  );
  if (updateResult.isErr()) {
    return err(updateResult.error);
  }

  // Return suspended result with properly re-rooted stacks
  return ok({
    status: 'suspended',
    suspensions: [
      ...savedState.suspensions,
      ...updatedParentState.suspensions,
      ...reRootedStacks.map((s) => s.leafSuspension),
      ...remainingRootStacks.map((s) => s.leafSuspension),
    ],
    suspensionStacks: updatedRootState.suspensionStacks,
    runId: savedState.id,
  });
}
