import type { IAgentStateCache } from '@backend/agents/infrastructure/cache';
import type { ICompletionsGateway } from '@backend/ai/completions/domain/CompletionsGateway';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type {
  AgentInput,
  AgentManifest,
  AgentRunResult,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { buildAgentRunResult, executeAgentLoop } from './loop';
import { prepareRunState } from './prepare';
import { resumeFromSuspensionStack } from './resume';
import { createAgentState } from './state';
import { buildAgentTools } from './tools/buildAgentTools';

export interface RunAgentDeps {
  readonly completionsGateway: ICompletionsGateway;
  readonly mcpService: IMCPService;
  readonly stateCache: IAgentStateCache;
  readonly storageService: IStorageService;
  readonly logger: ILogger;
}

/**
 * Unified agent execution entry point.
 *
 * Handles three types of execution:
 * 1. Fresh start from AgentRequest
 * 2. Reply to a completed agent with additional user message
 * 3. Resume suspended agent after tool approval
 *
 * All execution paths:
 * - Prepare state (initialize or restore)
 * - Run agent loop (pure execution)
 * - Save final state (complete, suspended, or error)
 *
 * NOTE: Callers should validate the agent configuration before calling this function
 * using `validateAgentConfig(manifest, manifests)` to ensure sub-agent references
 * and other config validations pass. This validation will be automatic when using
 * AgentService (Phase 7), but direct callers should validate manually.
 */
export async function runAgent(
  ctx: Context,
  manifest: AgentManifest,
  input: AgentInput,
  deps: RunAgentDeps,
): Promise<Result<AgentRunResult, AppError>> {
  // 1. Build tools first (needs manifestMap from input)
  const toolsResult = await buildAgentTools(
    ctx,
    manifest,
    input.manifestMap,
    deps,
  );

  if (toolsResult.isErr()) {
    return err(toolsResult.error);
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
    return err(prepareResult.error);
  }

  const prepareValue = prepareResult.value;

  // Extract options from input
  const options = input.options;

  // Handle resume - delegate to resume module
  if (prepareValue.type === 'resume') {
    return resumeFromSuspensionStack(
      ctx,
      manifest,
      input.manifestMap,
      prepareValue.savedState,
      prepareValue.matchingStack,
      prepareValue.response,
      deps,
      options,
    );
  }

  // Handle supended (partial resume)
  if (prepareValue.type === 'suspended') {
    return ok({
      status: 'suspended',
      suspensions: prepareValue.remainingSuspensions,
      suspensionStacks: [],
      runId: prepareValue.runId,
    });
  }

  // Type is 'ready' - continue to execution loop
  const { state, context, previousElapsedMs } = prepareValue;

  // 3. Run the agent loop (pure execution)
  const result = await executeAgentLoop(
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

  if (result.isErr()) {
    // Even on loop error, save the error state
    const saveResult = await createAgentState(
      {
        ctx,
        manifest,
        context,
        loopResult: {
          status: 'error',
          error: result.error,
          finalState: state,
        },
        previousElapsedMs,
      },
      deps,
      options,
    );

    if (saveResult.isErr()) {
      // If we can't save the error state, return the save error
      return err(saveResult.error);
    }

    return err(result.error);
  }

  // 4. Save final state
  const saveResult = await createAgentState(
    {
      ctx,
      manifest,
      context,
      loopResult: result.value,
      previousElapsedMs,
    },
    deps,
    options,
  );

  if (saveResult.isErr()) {
    return err(saveResult.error);
  }

  const stateId = saveResult.value;

  // 5. Build and return result with stateId
  return buildAgentRunResult(result.value, stateId, manifest);
}
