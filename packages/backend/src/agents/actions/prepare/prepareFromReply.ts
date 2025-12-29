import type {
  AgentManifest,
  AgentRunOptions,
  PrepareDeps,
} from '@backend/agents/domain';
import type { PrepareResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId, AgentTool } from '@core/domain/agents';
import type { Message } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { restoreAgentRun } from '../initialize/restoreAgentRun';
import { loadAndValidateState } from '../state/loadAndValidateState';

/**
 * Prepares agent run state from a reply to a completed agent.
 * Loads the completed state and adds the user's message.
 * Uses EXISTING stateId from savedState.id.
 * Tools are pre-built and passed in.
 */
export async function prepareFromReply(
  ctx: Context,
  manifest: AgentManifest,
  stateId: AgentRunId,
  message: string | Message,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
  deps: Pick<PrepareDeps, 'stateCache' | 'storageService' | 'logger'>,
  options?: AgentRunOptions,
): Promise<Result<PrepareResult, AppError>> {
  // 1. Load and validate saved state
  const stateResult = await loadAndValidateState(
    ctx,
    stateId,
    manifest,
    'completed',
    deps,
  );

  if (stateResult.isErr()) {
    return err(stateResult.error);
  }

  const savedState = stateResult.value;

  // 2. Restore agent run state (deserialize messages, use pre-built tools)
  const restoreResult = await restoreAgentRun(
    ctx,
    manifest,
    savedState,
    tools,
    toolsMap,
    {
      storageService: deps.storageService,
      logger: deps.logger,
    },
    options,
  );

  if (restoreResult.isErr()) {
    return err(restoreResult.error);
  }

  const state = restoreResult.value;

  // 3. Add user's reply message
  const userMessage: Message =
    typeof message === 'string'
      ? { role: 'user', content: [{ type: 'text', text: message }] }
      : message;

  state.messages = [...state.messages, userMessage];

  return ok({
    type: 'continue', // Signals: UPDATE existing state to running
    stateId: savedState.id, // Use EXISTING stateId
    state,
    context: savedState.context,
    previousElapsedMs: savedState.elapsedExecutionMs,
    parentContext: savedState.parentContext,
    // No resolvedSuspensions - this is a reply to a completed agent, not a resume from suspension
  });
}
