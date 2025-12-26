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
import { err, type Result } from 'neverthrow';
import { buildAgentTools } from '../tools/buildAgentTools';
import { buildAgentRunResult, executeAgentLoop, saveAgentState } from './loop';
import { prepareRunState } from './prepare';

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

  const { state, context, previousElapsedMs } = prepareResult.value;

  // 2. Run the agent loop (pure execution)
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
    const saveResult = await saveAgentState(
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
    );

    if (saveResult.isErr()) {
      // If we can't save the error state, return the save error
      return err(saveResult.error);
    }

    return err(result.error);
  }

  // 3. Save final state
  const saveResult = await saveAgentState(
    {
      ctx,
      manifest,
      context,
      loopResult: result.value,
      previousElapsedMs,
    },
    deps,
  );

  if (saveResult.isErr()) {
    return err(saveResult.error);
  }

  const stateId = saveResult.value;

  // 4. Build and return result with stateId
  return buildAgentRunResult(result.value, stateId);
}
