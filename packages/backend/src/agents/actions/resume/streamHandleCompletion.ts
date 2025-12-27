import type { AgentRunOptions, AgentState } from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentEvent,
  AgentInput,
  AgentManifest,
  AgentRunResult,
  SuspensionStack,
} from '@core/domain/agents';
import type { RequestToolResultPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { updateAgentState } from '../state';
import {
  type StreamAgentDeps,
  type StreamAgentItem,
  streamAgent,
} from '../streamAgent';

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
  manifestMap: Map<string, AgentManifest>,
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
    actions,
  );
}

/**
 * Type guard to check if a StreamAgentItem is an event Result.
 * Result objects have isOk/isErr methods, while StreamAgentFinalResult doesn't.
 */
function isEventResult(
  item: StreamAgentItem,
): item is Result<AgentEvent, AppError> {
  return 'isOk' in item;
}

/**
 * Helper: Run streamAgent and yield all events, returning the final result.
 *
 * This is the key function that enables streaming during resume.
 * It consumes streamAgent's output, yields all events, and extracts the final result.
 */
async function* runStreamAgentAndYieldEvents(
  ctx: Context,
  manifest: AgentManifest,
  input: AgentInput,
  deps: StreamAgentDeps,
  actions: StreamHandleCompletionActions,
): AsyncGenerator<
  Result<AgentEvent, AppError>,
  Result<AgentRunResult, AppError>
> {
  for await (const item of actions.streamAgent(ctx, manifest, input, deps)) {
    // Check if this is an event Result (has isOk method)
    if (isEventResult(item)) {
      yield item;
      continue;
    }

    // At this point, item is StreamAgentFinalResult
    return item.result;
  }

  // Should never reach here - streamAgent always yields a final result
  return err(internalError('streamAgent ended without final result'));
}
