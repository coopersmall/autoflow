import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentManifest, AgentRunId } from '@core/domain/agents';
import type { Message } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { restoreAgentRun } from '../initialize/initializeAgentRun';
import { loadAndValidateState } from './loadAndValidateState';
import type { PrepareAgentRunDeps, PrepareResult } from './PrepareResult';

/**
 * Prepares agent run state from a reply to a completed agent.
 * Loads the completed state and adds the user's message.
 */
export async function prepareFromReply(
  ctx: Context,
  manifest: AgentManifest,
  stateId: AgentRunId,
  message: string | Message,
  deps: PrepareAgentRunDeps,
): Promise<Result<PrepareResult, AppError>> {
  // 1. Load and validate saved state
  const stateResult = await loadAndValidateState(
    ctx,
    stateId,
    manifest,
    'completed',
    deps.stateCache,
  );

  if (stateResult.isErr()) {
    return err(stateResult.error);
  }

  const savedState = stateResult.value;

  // 2. Restore agent run state (deserialize messages, rebuild tools)
  const restoreResult = await restoreAgentRun(ctx, manifest, savedState, {
    mcpService: deps.mcpService,
    storageService: deps.storageService,
    logger: deps.logger,
  });

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
    state,
    context: savedState.context,
    previousElapsedMs: savedState.elapsedExecutionMs,
  });
}
