import type {
  AgentExecutionDeps,
  AgentInput,
  AgentManifest,
} from '@backend/agents/domain';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentEvent, AgentRunResult } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { type ExecuteAgentDeps, executeAgent } from './loop/executeAgent';
import { prepareRunState } from './prepare';
import { streamResumeFromSuspensionStack } from './resume';
import type { StreamAgentDeps } from './streamAgent';
import { buildAgentTools } from './tools/buildAgentTools';
import { withCancellationPolling } from './withCancellationPolling';

export interface OrchestrateAgentRunDeps
  extends ExecuteAgentDeps,
    AgentExecutionDeps {
  readonly mcpService: IMCPService;
}

/**
 * Unified agent execution orchestration.
 *
 * This is the single entry point for agent execution that handles:
 * 1. Tool building
 * 2. State preparation (get stateId from prepare functions)
 * 3. Routing for delegate/suspended cases
 * 4. Wrapping executeAgent with cancellation polling
 * 5. Yielding events from execution
 *
 * Both runAgent and streamAgent delegate to this function.
 *
 * @param ctx - The request context with correlationId and abort signal
 * @param manifest - The root agent manifest configuration
 * @param input - The agent input including prompt, manifestMap, and options
 * @param deps - Dependencies required for execution
 * @returns An async generator yielding events and returning the final result
 */
export async function* orchestrateAgentRun(
  ctx: Context,
  manifest: AgentManifest,
  input: AgentInput,
  deps: OrchestrateAgentRunDeps,
): AsyncGenerator<
  Result<AgentEvent, AppError>,
  Result<AgentRunResult, AppError>
> {
  const options = input.options;

  // 1. Build tools
  const toolsResult = await buildAgentTools(
    ctx,
    manifest,
    input.manifestMap,
    deps,
  );
  if (toolsResult.isErr()) {
    return err(toolsResult.error);
  }
  const { tools, toolsMap, cleanup } = toolsResult.value;

  // 2. Prepare run state
  const prepareResult = await prepareRunState(
    ctx,
    manifest,
    input,
    tools,
    toolsMap,
    deps,
  );
  if (prepareResult.isErr()) {
    await cleanup();
    return err(prepareResult.error);
  }

  const prepareValue = prepareResult.value;

  // 3. Handle delegate - no cancellation polling needed (handled recursively)
  if (prepareValue.type === 'delegate') {
    // Create a recursive streamAgent that uses orchestrateAgentRun
    // We capture deps from closure and ignore the passed deps parameter
    const recursiveStreamAgent = (
      innerCtx: Context,
      innerManifest: AgentManifest,
      innerInput: AgentInput,
      _innerDeps: StreamAgentDeps, // Ignored - we use captured deps
    ) => {
      const generator = orchestrateAgentRun(
        innerCtx,
        innerManifest,
        innerInput,
        deps, // Use captured deps from closure
      );

      // Wrap as async generator that yields StreamAgentItem format
      return (async function* () {
        while (true) {
          const next = await generator.next();
          if (next.done) {
            yield { type: 'final' as const, result: next.value };
            return;
          }
          yield next.value;
        }
      })();
    };

    // Note: cleanup not called here - delegate continues execution in a new context
    // The recursive orchestrateAgentRun will build its own tools and cleanup
    return yield* streamResumeFromSuspensionStack(
      ctx,
      manifest,
      input.manifestMap,
      prepareValue.savedState,
      prepareValue.matchingStack,
      prepareValue.response,
      deps,
      { streamAgent: recursiveStreamAgent },
      options,
    );
  }

  // 4. Handle suspended - no execution needed
  if (prepareValue.type === 'suspended') {
    await cleanup();
    return ok({
      status: 'suspended',
      suspensions: prepareValue.remainingSuspensions,
      suspensionStacks: [],
      runId: prepareValue.runId,
    });
  }

  // 5. Handle already-running - agent is being executed by another process
  if (prepareValue.type === 'already-running') {
    await cleanup();
    return ok({
      status: 'already-running',
      runId: prepareValue.runId,
    });
  }

  const { stateId, state, context, previousElapsedMs } = prepareValue;
  const isNewState = prepareValue.type === 'start';
  // For 'continue' type, extract parentContext and resolvedSuspensions from saved state
  const parentContext =
    prepareValue.type === 'continue'
      ? prepareValue.parentContext
      : input.parentContext;
  const resolvedSuspensions =
    prepareValue.type === 'continue'
      ? prepareValue.resolvedSuspensions
      : undefined;

  const generator = withCancellationPolling(
    ctx,
    stateId,
    (derivedCtx) =>
      executeAgent(
        {
          ctx: derivedCtx,
          stateId,
          manifest,
          state,
          context,
          previousElapsedMs,
          isNewState,
          parentContext,
          resolvedSuspensions,
          cleanup,
        },
        deps,
        options,
      ),
    deps,
    { pollIntervalMs: options?.cancellationPollIntervalMs },
  );

  return yield* generator;
}
