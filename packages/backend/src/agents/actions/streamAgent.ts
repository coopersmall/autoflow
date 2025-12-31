import type {
  AgentExecutionDeps,
  AgentInput,
  AgentManifest,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentEvent, AgentRunResult } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import { orchestrateAgentRun } from './orchestrateAgentRun';

/**
 * Dependencies required for streaming an agent.
 * Equivalent to AgentExecutionDeps which includes all core agent infrastructure.
 */
export type StreamAgentDeps = AgentExecutionDeps;

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
 * @param ctx - The request context with correlationId and abort signal
 * @param manifest - The root agent manifest configuration
 * @param input - The agent input including prompt, manifestMap, and options
 * @param deps - Dependencies required for execution (completions, state, etc.)
 * @returns An async generator yielding StreamAgentItem (events or final result)
 *
 * @example
 * ```ts
 * for await (const item of streamAgent(ctx, manifest, input, deps)) {
 *   if ('type' in item && item.type === 'final') {
 *     const result = item.result;
 *   } else if (item.isOk()) {
 *     handleEvent(item.value);
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
