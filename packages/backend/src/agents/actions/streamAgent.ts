import type { IAgentCancellationCache } from '@backend/agents/infrastructure/cache';
import type { IAgentRunLock } from '@backend/agents/infrastructure/lock';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type {
  AgentEvent,
  AgentInput,
  AgentManifest,
  AgentRunResult,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import type { IAgentStateCache } from '../infrastructure/cache';
import { orchestrateAgentRun } from './orchestrateAgentRun';

export interface StreamAgentDeps {
  readonly completionsGateway: ICompletionsGateway;
  readonly mcpService: IMCPService;
  readonly stateCache: IAgentStateCache;
  readonly storageService: IStorageService;
  readonly logger: ILogger;
  readonly agentRunLock: IAgentRunLock;
  readonly cancellationCache: IAgentCancellationCache;
}

/**
 * Result yielded at the end of the stream containing the final outcome.
 */
export interface StreamAgentFinalResult {
  readonly type: 'final';
  readonly result: Result<AgentRunResult, AppError>;
}

/**
 * Items yielded during agent streaming.
 * Either an event (success or error) or the final result.
 */
export type StreamAgentItem =
  | Result<AgentEvent, AppError>
  | StreamAgentFinalResult;

/**
 * Streaming agent execution entry point.
 *
 * Thin wrapper around orchestrateAgentRun that yields events as they arrive
 * and wraps the final result in a StreamAgentFinalResult.
 *
 * Handles three types of execution:
 * 1. Fresh start from AgentRequest
 * 2. Reply to a completed agent with additional user message
 * 3. Resume suspended agent after tool approval
 *
 * Usage:
 * ```ts
 * for await (const item of streamAgent(ctx, manifest, input, deps)) {
 *   if ('type' in item && item.type === 'final') {
 *     // Handle final result
 *     const result = item.result;
 *   } else {
 *     // Handle event (Result<AgentEvent, AppError>)
 *     if (item.isOk()) {
 *       handleEvent(item.value);
 *     }
 *   }
 * }
 * ```
 */
export async function* streamAgent(
  ctx: Context,
  manifest: AgentManifest,
  input: AgentInput,
  deps: StreamAgentDeps,
): AsyncGenerator<StreamAgentItem, void> {
  const generator = orchestrateAgentRun(ctx, manifest, input, deps);

  // Yield all events, then yield final result wrapped in StreamAgentFinalResult
  while (true) {
    const next = await generator.next();
    if (next.done) {
      yield { type: 'final', result: next.value };
      return;
    }
    yield next.value; // Pass through events to caller
  }
}
