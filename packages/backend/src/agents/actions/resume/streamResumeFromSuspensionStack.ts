import type {
  AgentManifest,
  AgentRunOptions,
  AgentState,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentEvent,
  AgentRunResult,
  ContinueResponse,
  ManifestKey,
  SuspensionStack,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { badRequest, internalError, notFound } from '@core/errors/factories';
import { err, type Result } from 'neverthrow';
import { getAgentState, updateAgentState } from '../state';
import { type StreamAgentDeps, streamAgent } from '../streamAgent';
import { runStreamAgentAndYieldEvents } from '../streaming/streamHelpers';
import { buildReRootedStacks } from './buildReRootedStacks';
import { convertResultToToolPart } from './convertResultToToolPart';
import { handleIntermediateParentStillSuspended } from './handleIntermediateParentStillSuspended';
import { handleResuspension } from './handleResuspension';
import { lookupManifest } from './lookupManifest';
import { streamHandleCompletion } from './streamHandleCompletion';

export type StreamResumeFromStackDeps = StreamAgentDeps;
export interface StreamResumeFromStackActions {
  readonly streamAgent: typeof streamAgent;
}

/**
 * Streaming resume from suspension stack - SOURCE OF TRUTH.
 *
 * All complex multi-level propagation logic lives here.
 * The non-streaming resumeFromSuspensionStack consumes this generator.
 *
 * Yields events as agents execute during resume.
 *
 * The stack structure is: [root, child, grandchild, ..., deepest]
 * where the last entry is the agent that actually triggered the suspension.
 */
export async function* streamResumeFromSuspensionStack(
  ctx: Context,
  manifest: AgentManifest,
  manifestMap: ReadonlyMap<ManifestKey, AgentManifest>,
  savedState: AgentState,
  matchingStack: SuspensionStack,
  response: ContinueResponse,
  deps: StreamResumeFromStackDeps,
  actions: StreamResumeFromStackActions = { streamAgent },
  options?: AgentRunOptions,
): AsyncGenerator<
  Result<AgentEvent, AppError>,
  Result<AgentRunResult, AppError>
> {
  const stackEntries = matchingStack.agents;

  // After fix: stacks always have at least 2 entries (parent + child)
  if (stackEntries.length < 2) {
    return err(
      internalError('Invalid suspension stack: must have at least 2 entries', {
        metadata: {
          stackLength: stackEntries.length,
          approvalId: response.approvalId,
        },
      }),
    );
  }

  // Stack is [us, child, grandchild, ..., deepest]
  // Last entry is the agent that actually suspended
  const deepestEntry = stackEntries[stackEntries.length - 1];
  const deepestManifest = lookupManifest(deepestEntry, manifestMap);

  if (!deepestManifest) {
    return err(
      notFound(
        `Manifest not found: ${deepestEntry.manifestId}:${deepestEntry.manifestVersion}`,
      ),
    );
  }

  // Resume the deepest agent with the approval (streaming)
  let currentResult = yield* runStreamAgentAndYieldEvents(
    ctx,
    deepestManifest,
    {
      type: 'approval',
      runId: deepestEntry.stateId,
      response,
      manifestMap,
      options,
    },
    deps,
    actions.streamAgent,
  );

  if (currentResult.isErr()) {
    return err(currentResult.error);
  }

  // Propagate up through intermediate levels (from deepest-1 to index 1)
  // Index 0 is "us" (handled at the end)
  for (let i = stackEntries.length - 2; i >= 1; i--) {
    const parentEntry = stackEntries[i];
    const childEntry = stackEntries[i + 1];

    // Handle re-suspension at this level
    if (currentResult.value.status === 'suspended') {
      const parentPath = stackEntries.slice(0, i + 1);
      const allNewStacks = buildReRootedStacks(
        parentPath,
        childEntry,
        currentResult.value,
      );

      return handleResuspension(
        ctx,
        savedState,
        matchingStack,
        { ...currentResult.value, suspensionStacks: allNewStacks },
        deps,
        options,
      );
    }

    // Validate parent has pendingToolCallId (the tool call that invoked the child)
    const parentToolCallId = parentEntry.pendingToolCallId;
    if (!parentToolCallId) {
      return err(
        internalError('Parent stack entry missing pendingToolCallId', {
          metadata: {
            stackIndex: i,
            parentManifestId: parentEntry.manifestId,
            parentStateId: parentEntry.stateId,
          },
        }),
      );
    }

    // Handle cancellation - treat as error for resume purposes
    if (currentResult.value.status === 'cancelled') {
      return err(
        badRequest('Cannot resume: agent execution was cancelled', {
          metadata: { runId: currentResult.value.runId },
        }),
      );
    }

    // Handle already-running - treat as error for resume purposes
    if (currentResult.value.status === 'already-running') {
      return err(
        badRequest('Cannot resume: agent is already running', {
          metadata: { runId: currentResult.value.runId },
        }),
      );
    }

    // Convert child result to tool result
    // Use PARENT's pendingToolCallId (the tool call waiting for this result)
    // Use CHILD's manifestId (for tool naming)
    const toolResult = convertResultToToolPart(
      parentToolCallId,
      childEntry.manifestId,
      currentResult.value,
    );

    // Find parent manifest
    const parentManifest = lookupManifest(parentEntry, manifestMap);
    if (!parentManifest) {
      return err(
        notFound(
          `Manifest not found: ${parentEntry.manifestId}:${parentEntry.manifestVersion}`,
        ),
      );
    }

    // Load parent state and inject tool result
    const parentStateResult = await getAgentState(
      ctx,
      parentEntry.stateId,
      deps,
    );
    if (parentStateResult.isErr()) {
      return err(parentStateResult.error);
    }

    const parentState = parentStateResult.value;
    if (!parentState) {
      return err(notFound(`Parent state not found: ${parentEntry.stateId}`));
    }

    // Update parent state with the tool result
    const updatedParentState: AgentState = {
      ...parentState,
      pendingToolResults: [...parentState.pendingToolResults, toolResult],
      suspensionStacks: parentState.suspensionStacks.filter(
        (s) =>
          s.leafSuspension.approvalId !==
          matchingStack.leafSuspension.approvalId,
      ),
      updatedAt: new Date(),
    };

    const updateResult = await updateAgentState(
      ctx,
      parentEntry.stateId,
      updatedParentState,
      deps,
      options,
    );
    if (updateResult.isErr()) {
      return err(updateResult.error);
    }

    // Check if parent has remaining suspensions
    if (
      updatedParentState.suspensions.length > 0 ||
      updatedParentState.suspensionStacks.length > 0
    ) {
      // Parent still suspended - need to re-root stacks and update root state
      const pathToParent = stackEntries.slice(0, i + 1);
      return handleIntermediateParentStillSuspended(
        ctx,
        savedState,
        matchingStack,
        pathToParent,
        parentEntry,
        updatedParentState,
        deps,
        options,
      );
    }

    // All parent's suspensions resolved - resume parent with accumulated tool results (streaming)
    currentResult = yield* runStreamAgentAndYieldEvents(
      ctx,
      parentManifest,
      {
        type: 'continue',
        runId: parentEntry.stateId,
        manifestMap,
        options,
      },
      deps,
      actions.streamAgent,
    );

    if (currentResult.isErr()) {
      return err(currentResult.error);
    }
  }

  // Handle final propagation to "us" (index 0)
  const ourEntry = stackEntries[0]; // "us" - the root of this stack
  const childEntry = stackEntries[1]; // Our immediate child

  // Check if immediate child suspended
  if (currentResult.value.status === 'suspended') {
    const parentPath = [ourEntry];
    const allNewStacks = buildReRootedStacks(
      parentPath,
      childEntry,
      currentResult.value,
    );

    return handleResuspension(
      ctx,
      savedState,
      matchingStack,
      { ...currentResult.value, suspensionStacks: allNewStacks },
      deps,
      options,
    );
  }

  // Validate OUR entry has pendingToolCallId (the tool call that invoked the child)
  const ourToolCallId = ourEntry.pendingToolCallId;
  if (!ourToolCallId) {
    return err(
      internalError('Root stack entry missing pendingToolCallId', {
        metadata: {
          rootManifestId: ourEntry.manifestId,
          rootStateId: ourEntry.stateId,
        },
      }),
    );
  }

  // Handle cancellation - treat as error for resume purposes
  if (currentResult.value.status === 'cancelled') {
    return err(
      badRequest('Cannot resume: agent execution was cancelled', {
        metadata: { runId: currentResult.value.runId },
      }),
    );
  }

  // Handle already-running - treat as error for resume purposes
  if (currentResult.value.status === 'already-running') {
    return err(
      badRequest('Cannot resume: agent is already running', {
        metadata: { runId: currentResult.value.runId },
      }),
    );
  }

  // Convert to tool result
  // Use OUR pendingToolCallId (the tool call waiting for this result)
  // Use CHILD's manifestId (for tool naming)
  const toolResult = convertResultToToolPart(
    ourToolCallId,
    childEntry.manifestId,
    currentResult.value,
  );

  // Handle completion for us (streaming)
  return yield* streamHandleCompletion(
    ctx,
    manifest,
    manifestMap,
    savedState,
    matchingStack,
    toolResult,
    deps,
    { streamAgent: actions.streamAgent },
    options,
  );
}
