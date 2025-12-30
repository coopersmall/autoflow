import type {
  AgentManifest,
  AgentRunOptions,
  PrepareDeps,
} from '@backend/agents/domain';
import type { PrepareResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId, AgentTool } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { badRequest, notFound } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { restoreAgentRun } from '../initialize/restoreAgentRun';
import { buildToolResultMessage } from '../messages/buildToolResultMessage';
import { getAgentState } from '../state/getAgentState';
import { validateAgentState } from '../validation/validateAgentState';

/**
 * Prepares agent state for continuation after sub-agent suspensions resolved.
 * Used when a parent agent's sub-agents have completed and results are pending.
 * Returns 'already-running' if agent is currently executing.
 * Uses EXISTING stateId from savedState.id.
 */
export async function prepareFromContinue(
  ctx: Context,
  manifest: AgentManifest,
  runId: AgentRunId,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
  deps: PrepareDeps,
  options?: AgentRunOptions,
): Promise<Result<PrepareResult, AppError>> {
  // 1. Load saved state from cache
  const stateResult = await getAgentState(ctx, runId, deps);
  if (stateResult.isErr()) {
    return err(stateResult.error);
  }

  const savedState = stateResult.value;
  if (!savedState) {
    return err(
      notFound('Agent state not found', {
        metadata: { stateId: runId },
      }),
    );
  }

  // 2. Check if agent is already running - return early without error
  if (savedState.status === 'running') {
    return ok({
      type: 'already-running',
      runId,
    });
  }

  // 3. Validate state status and manifest
  const validationResult = validateAgentState(
    savedState,
    manifest,
    'suspended',
  );
  if (validationResult.isErr()) {
    return err(validationResult.error);
  }

  // Validate no remaining suspensions
  if (
    savedState.suspensions.length > 0 ||
    savedState.suspensionStacks.length > 0
  ) {
    return err(
      badRequest('Cannot continue: agent still has pending suspensions'),
    );
  }

  // Validate we have pending tool results
  if (savedState.pendingToolResults.length === 0) {
    return err(badRequest('Cannot continue: no pending tool results'));
  }

  // Restore agent run state
  const restoreResult = await restoreAgentRun(
    ctx,
    manifest,
    savedState,
    tools,
    toolsMap,
    deps,
    options,
  );

  if (restoreResult.isErr()) {
    return err(restoreResult.error);
  }

  const state = restoreResult.value;

  // Add pending tool results as a tool message
  const toolResultMessage = buildToolResultMessage(
    savedState.pendingToolResults,
  );
  state.messages = [...state.messages, toolResultMessage];

  return ok({
    type: 'continue', // Signals: UPDATE existing state to running
    stateId: savedState.id, // Use EXISTING stateId
    state,
    context: savedState.context,
    previousElapsedMs: savedState.elapsedExecutionMs,
    parentContext: savedState.parentContext,
    // No resolvedSuspensions - this is resuming after sub-agent suspensions resolved,
    // not after approval of this agent's own suspensions
  });
}
