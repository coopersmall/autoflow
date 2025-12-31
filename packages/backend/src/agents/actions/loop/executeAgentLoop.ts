import type { AgentManifest, AgentRunState } from '@backend/agents/domain';
import type { LoopResult } from '@backend/agents/domain/execution';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import { consumeGenerator } from '../utils/consumeGenerator';
import { unifiedAgentLoop } from './unifiedAgentLoop';

export interface ExecuteAgentLoopDeps {
  readonly completionsGateway: ICompletionsGateway;
}

export interface ExecuteAgentLoopParams {
  readonly ctx: Context;
  readonly manifest: AgentManifest;
  readonly state: AgentRunState;
  readonly previousElapsedMs?: number;
  readonly parentManifestId?: AgentId;
}

/**
 * Non-streaming agent execution loop - consumes the unified streaming loop.
 *
 * This is a thin wrapper around unifiedAgentLoop that discards yielded events.
 * All complex execution logic lives in unifiedAgentLoop.
 *
 * This function:
 * 1. Calls unifiedAgentLoop which is an async generator
 * 2. Consumes all yielded events (discarding them)
 * 3. Returns the final result
 *
 * The caller is responsible for persisting state.
 */
export async function executeAgentLoop(
  params: ExecuteAgentLoopParams,
  deps: ExecuteAgentLoopDeps,
): Promise<Result<LoopResult, AppError>> {
  const generator = unifiedAgentLoop(
    {
      ctx: params.ctx,
      manifest: params.manifest,
      state: params.state,
      previousElapsedMs: params.previousElapsedMs,
      parentManifestId: params.parentManifestId,
    },
    deps,
  );

  // Consume all events (discarding them) and return the final result
  return consumeGenerator(generator);
}
