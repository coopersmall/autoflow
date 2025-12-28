import type { AgentRunOptions, PrepareDeps } from '@backend/agents/domain';
import type { PrepareResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentManifest, AgentRunId, AgentTool } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { restoreAgentRun } from '../initialize/restoreAgentRun';
import { buildToolResultMessage } from '../messages/buildToolResultMessage';
import { loadAndValidateState } from '../state/loadAndValidateState';

/**
 * Prepares agent state for continuation after sub-agent suspensions resolved.
 * Used when a parent agent's sub-agents have completed and results are pending.
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
  // Load and validate state
  const stateResult = await loadAndValidateState(
    ctx,
    runId,
    manifest,
    'suspended',
    deps,
  );

  if (stateResult.isErr()) {
    return err(stateResult.error);
  }

  const savedState = stateResult.value;

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
  });
}
