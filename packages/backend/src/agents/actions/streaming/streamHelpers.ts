import type { AgentExecutionDeps } from '@backend/agents/domain/dependencies';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentEvent,
  AgentInput,
  AgentManifest,
  AgentRunResult,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { internalError } from '@core/errors/factories';
import { err, type Result } from 'neverthrow';
import type { StreamAgentItem } from '../streamAgent';
import { streamAgent } from '../streamAgent';

/**
 * Runs streamAgent and yields all events, returning the final result.
 *
 * This is a reusable helper for consuming streaming agent execution.
 * It handles the pattern of:
 * 1. Yielding all events as they arrive
 * 2. Extracting and returning the final result
 *
 * Used by:
 * - streamResumeFromSuspensionStack
 * - streamHandleCompletion
 *
 * @param ctx - Execution context
 * @param manifest - Agent manifest
 * @param input - Agent input (request, reply, approval, or continue)
 * @param deps - Execution dependencies
 * @param streamAgentFn - streamAgent function (injectable for testing)
 * @returns AsyncGenerator that yields events and returns final result
 */
export async function* runStreamAgentAndYieldEvents(
  ctx: Context,
  manifest: AgentManifest,
  input: AgentInput,
  deps: AgentExecutionDeps,
  streamAgentFn: typeof streamAgent = streamAgent,
): AsyncGenerator<
  Result<AgentEvent, AppError>,
  Result<AgentRunResult, AppError>
> {
  for await (const item of streamAgentFn(ctx, manifest, input, deps)) {
    if (isEventResult(item)) {
      yield item;
      continue;
    }
    // item is StreamAgentFinalResult
    return item.result;
  }

  // Should never reach here - streamAgent always yields a final result
  return err(internalError('streamAgent ended without final result'));
}

/**
 * Type guard to check if a StreamAgentItem is an event Result.
 *
 * Result objects have isOk/isErr methods, while StreamAgentFinalResult has
 * a 'type' field and doesn't have these methods.
 */
export function isEventResult(
  item: StreamAgentItem,
): item is Result<AgentEvent, AppError> {
  return 'isOk' in item;
}
