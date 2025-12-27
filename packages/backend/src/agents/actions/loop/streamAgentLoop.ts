import type { AgentRunState } from '@backend/agents/domain';
import type { LoopResult } from '@backend/agents/domain/execution';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentEvent, AgentId, AgentManifest } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import { unifiedAgentLoop } from './unifiedAgentLoop';

export interface StreamAgentLoopDeps {
  readonly completionsGateway: ICompletionsGateway;
}

export interface StreamAgentLoopParams {
  readonly ctx: Context;
  readonly manifest: AgentManifest;
  readonly state: AgentRunState;
  readonly previousElapsedMs?: number;
  readonly parentManifestId?: AgentId;
}

// StreamAgentLoopResult is now LoopResult from domain (imported above)
export type { LoopResult as StreamAgentLoopResult } from '@backend/agents/domain/execution';

/**
 * Streaming agent execution loop - thin wrapper around unifiedAgentLoop.
 *
 * Unlike the non-streaming executeAgentLoop which discards events,
 * this function yields all events from the unified loop.
 *
 * This is essentially a pass-through to unifiedAgentLoop with the same signature.
 * The separation exists to maintain backwards compatibility with existing code.
 */
export async function* streamAgentLoop(
  params: StreamAgentLoopParams,
  deps: StreamAgentLoopDeps,
): AsyncGenerator<Result<AgentEvent, AppError>, Result<LoopResult, AppError>> {
  return yield* unifiedAgentLoop(
    {
      ctx: params.ctx,
      manifest: params.manifest,
      state: params.state,
      previousElapsedMs: params.previousElapsedMs,
      parentManifestId: params.parentManifestId,
    },
    deps,
  );
}

// Re-export utilities from stream module that are still used
export { getAllowedEventTypes } from '../streaming/transformStreamPart';
