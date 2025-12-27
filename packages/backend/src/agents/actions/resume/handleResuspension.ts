import type {
  AgentRunOptions,
  AgentState,
  StateDeps,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunResult, SuspensionStack } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { updateAgentState } from '../state';

type SuspendedAgentRunResult = Extract<AgentRunResult, { status: 'suspended' }>;

/**
 * Handles when a resumed agent suspends again at any level.
 */
export async function handleResuspension(
  ctx: Context,
  savedState: AgentState,
  originalStack: SuspensionStack,
  suspendedResult: SuspendedAgentRunResult,
  deps: StateDeps,
  options?: AgentRunOptions,
): Promise<Result<AgentRunResult, AppError>> {
  // Remove the old stack and add new stacks from the re-suspension
  const remainingOtherStacks = savedState.suspensionStacks.filter(
    (s) =>
      s.leafSuspension.approvalId !== originalStack.leafSuspension.approvalId,
  );

  const updatedState: AgentState = {
    ...savedState,
    suspensionStacks: [
      ...remainingOtherStacks,
      ...suspendedResult.suspensionStacks, // Built by buildReRootedStacks
    ],
    updatedAt: new Date(),
  };

  const updateResult = await updateAgentState(
    ctx,
    savedState.id,
    updatedState,
    deps,
    options,
  );
  if (updateResult.isErr()) {
    return err(updateResult.error);
  }

  return ok({
    status: 'suspended',
    suspensions: [
      ...savedState.suspensions,
      ...suspendedResult.suspensions,
      ...remainingOtherStacks.map((s) => s.leafSuspension),
    ],
    suspensionStacks: updatedState.suspensionStacks,
    runId: savedState.id,
  });
}
