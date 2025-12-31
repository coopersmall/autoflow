import type {
  AgentManifest,
  AgentRunOptions,
  AgentState,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentEvent,
  AgentRunResult,
  ManifestKey,
  SuspensionStack,
} from '@core/domain/agents';
import type { RequestToolResultPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { updateAgentState } from '../state';
import { type StreamAgentDeps, streamAgent } from '../streamAgent';
import { runStreamAgentAndYieldEvents } from '../streaming/streamHelpers';

export interface StreamHandleCompletionDeps extends StreamAgentDeps {}

/**
 * Actions that can be injected for testing.
 */
export interface StreamHandleCompletionActions {
  readonly streamAgent: typeof streamAgent;
}

const defaultActions: StreamHandleCompletionActions = {
  streamAgent,
};

/**
 * Streaming handle completion - SOURCE OF TRUTH.
 *
 * Handles completion when the resumed sub-agent chain finishes.
 * If all suspensions are resolved, streams the continued agent execution.
 * The non-streaming handleCompletion consumes this generator.
 *
 * Yields events as the agent continues execution after all suspensions resolve.
 */
export async function* streamHandleCompletion(
  ctx: Context,
  manifest: AgentManifest,
  manifestMap: ReadonlyMap<ManifestKey, AgentManifest>,
  savedState: AgentState,
  completedStack: SuspensionStack,
  toolResult: RequestToolResultPart,
  deps: StreamHandleCompletionDeps,
  actions: StreamHandleCompletionActions = defaultActions,
  options?: AgentRunOptions,
): AsyncGenerator<
  Result<AgentEvent, AppError>,
  Result<AgentRunResult, AppError>
> {
  // Add to pending tool results
  const updatedPendingResults = [...savedState.pendingToolResults, toolResult];

  // Remove this stack from suspensionStacks
  const remainingStacks = savedState.suspensionStacks.filter(
    (s) =>
      s.leafSuspension.approvalId !== completedStack.leafSuspension.approvalId,
  );

  // ALWAYS save updated state
  const updatedState: AgentState = {
    ...savedState,
    suspensionStacks: remainingStacks,
    pendingToolResults: updatedPendingResults,
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

  // Check if we have remaining suspensions
  if (remainingStacks.length > 0 || savedState.suspensions.length > 0) {
    // Still have pending suspensions - return suspended (no streaming needed)
    return ok({
      status: 'suspended',
      suspensions: [
        ...savedState.suspensions,
        ...remainingStacks.map((s) => s.leafSuspension),
      ],
      suspensionStacks: remainingStacks,
      runId: savedState.id,
    });
  }

  // All suspensions resolved - stream the continued execution
  return yield* runStreamAgentAndYieldEvents(
    ctx,
    manifest,
    {
      type: 'continue',
      runId: savedState.id,
      manifestMap,
      options,
    },
    deps,
    actions.streamAgent,
  );
}
