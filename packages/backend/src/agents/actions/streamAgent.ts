import type { LoopResult } from '@backend/agents/domain/execution';
import type { IAgentStateCache } from '@backend/agents/infrastructure/cache';
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
import { err, ok, type Result } from 'neverthrow';
import { buildAgentRunResult } from './loop';
import { streamAgentLoop } from './loop/streamAgentLoop';
import { prepareRunState } from './prepare';
import { streamResumeFromSuspensionStack } from './resume';
import { createAgentState } from './state';
import { buildAgentTools } from './tools/buildAgentTools';

export interface StreamAgentDeps {
  readonly completionsGateway: ICompletionsGateway;
  readonly mcpService: IMCPService;
  readonly stateCache: IAgentStateCache;
  readonly storageService: IStorageService;
  readonly logger: ILogger;
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
 * Similar to runAgent but yields AgentEvent items in real-time as the LLM
 * generates content. The final item yielded is the StreamAgentFinalResult
 * containing the AgentRunResult.
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
  const manifestId = manifest.config.id;

  // 1. Build tools first (needs manifestMap from input)
  const toolsResult = await buildAgentTools(
    ctx,
    manifest,
    input.manifestMap,
    deps,
  );

  if (toolsResult.isErr()) {
    yield { type: 'final', result: err(toolsResult.error) };
    return;
  }

  const { tools, toolsMap } = toolsResult.value;

  // 2. Prepare agent run state based on input type
  const prepareResult = await prepareRunState(
    ctx,
    manifest,
    input,
    tools,
    toolsMap,
    deps,
  );

  if (prepareResult.isErr()) {
    yield { type: 'final', result: err(prepareResult.error) };
    return;
  }

  const prepareValue = prepareResult.value;

  // Extract options from input
  const options = input.options;

  // Handle resume - use streaming resume to yield events during resume
  if (prepareValue.type === 'resume') {
    const resumeGenerator = streamResumeFromSuspensionStack(
      ctx,
      manifest,
      input.manifestMap,
      prepareValue.savedState,
      prepareValue.matchingStack,
      prepareValue.response,
      deps,
      { streamAgent },
      options,
    );

    // Yield all events from resume, then yield the final result
    while (true) {
      const next = await resumeGenerator.next();
      if (next.done) {
        // Generator returned the final result
        yield { type: 'final', result: next.value };
        return;
      }
      // Yield the event
      yield next.value;
    }
  }

  // Handle suspended (partial resume) - no streaming needed
  if (prepareValue.type === 'suspended') {
    yield {
      type: 'final',
      result: ok({
        status: 'suspended',
        suspensions: prepareValue.remainingSuspensions,
        suspensionStacks: [],
        runId: prepareValue.runId,
      }),
    };
    return;
  }

  // Type is 'ready' - stream the execution loop
  const { state, context, previousElapsedMs } = prepareValue;

  // 3. Stream the agent loop, yielding events as they arrive
  let loopResult: LoopResult | undefined;

  const generator = streamAgentLoop(
    {
      ctx,
      manifest,
      state,
      previousElapsedMs,
    },
    {
      completionsGateway: deps.completionsGateway,
    },
  );

  while (true) {
    const next = await generator.next();

    if (next.done) {
      // Generator returned the final result
      const finalResult = next.value;

      if (finalResult.isErr()) {
        // Save error state
        await createAgentState(
          {
            ctx,
            manifest,
            context,
            loopResult: {
              status: 'error',
              error: finalResult.error,
              finalState: state,
            },
            previousElapsedMs,
          },
          deps,
          options,
        );

        // Yield error lifecycle event
        yield ok({
          type: 'agent-error',
          manifestId,
          parentManifestId: undefined,
          timestamp: Date.now(),
          error: {
            code: finalResult.error.code,
            message: finalResult.error.message,
          },
        });

        yield { type: 'final', result: err(finalResult.error) };
        return;
      }

      loopResult = finalResult.value;
      break;
    }

    // Yield the event
    yield next.value;
  }

  // 4. Save final state
  const saveResult = await createAgentState(
    {
      ctx,
      manifest,
      context,
      loopResult,
      previousElapsedMs,
    },
    deps,
    options,
  );

  if (saveResult.isErr()) {
    yield ok({
      type: 'agent-error',
      manifestId,
      parentManifestId: undefined,
      timestamp: Date.now(),
      error: {
        code: saveResult.error.code,
        message: saveResult.error.message,
      },
    });

    yield { type: 'final', result: err(saveResult.error) };
    return;
  }

  const runId = saveResult.value;

  // 5. Yield lifecycle event based on outcome
  if (loopResult.status === 'complete') {
    yield ok({
      type: 'agent-done',
      manifestId,
      parentManifestId: undefined,
      timestamp: Date.now(),
      result: loopResult.result,
    });
  } else if (loopResult.status === 'suspended') {
    // Yield agent-suspended for each suspension
    for (const suspension of loopResult.suspensions) {
      yield ok({
        type: 'agent-suspended',
        manifestId,
        parentManifestId: undefined,
        timestamp: Date.now(),
        suspension,
        stateId: runId,
      });
    }
  } else if (loopResult.status === 'error') {
    yield ok({
      type: 'agent-error',
      manifestId,
      parentManifestId: undefined,
      timestamp: Date.now(),
      error: {
        code: loopResult.error.code,
        message: loopResult.error.message,
      },
    });
  }

  // 6. Build and yield final result
  const agentRunResult = buildAgentRunResult(loopResult, runId, manifest);

  yield { type: 'final', result: agentRunResult };
}
