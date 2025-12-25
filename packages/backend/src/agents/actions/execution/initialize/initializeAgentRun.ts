import {
  type AgentRunState,
  type AgentState,
  DEFAULT_AGENT_TIMEOUT,
} from '@backend/agents/domain';
import type { IMCPService } from '@backend/ai/mcp/domain/MCPService';
import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type { AgentManifest, AgentRequest } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { deserializeMessages } from '../../serialization/deserializeMessages';
import { buildAgentTools } from '../../tools/buildAgentTools';
import { buildInitialMessages } from './buildInitialMessages';

export interface InitializeAgentRunDeps {
  readonly mcpService: IMCPService;
}

export interface RestoreAgentRunDeps {
  readonly mcpService: IMCPService;
  readonly storageService: IStorageService;
  readonly logger: ILogger;
}

/**
 * Initializes a fresh agent run state.
 *
 * Builds:
 * - Initial messages from manifest and request
 * - Tools array and map (including MCP tools)
 * - Tool execution harness
 * - Empty steps array and counters
 */
export async function initializeAgentRun(
  ctx: Context,
  manifest: AgentManifest,
  request: AgentRequest,
  deps: InitializeAgentRunDeps,
): Promise<Result<AgentRunState, AppError>> {
  const startTime = Date.now();
  const timeoutMs = manifest.config.timeout ?? DEFAULT_AGENT_TIMEOUT;

  // Initialize messages
  const messages = buildInitialMessages(manifest, request);

  // Build tools
  const toolsResult = await buildAgentTools(ctx, manifest, {
    mcpService: deps.mcpService,
  });

  if (toolsResult.isErr()) {
    return err(toolsResult.error);
  }

  const { tools, toolsMap } = toolsResult.value;

  return ok({
    startTime,
    timeoutMs,
    tools,
    toolsMap,
    messages,
    steps: [],
    stepNumber: 0,
    outputValidationRetries: 0,
  });
}

/**
 * Restores agent run state from saved state (for continueAgent).
 *
 * Re-builds tools and harness (they're not persisted), but uses saved:
 * - Messages (after deserializing binary content URLs)
 * - Steps history
 * - Current step number
 * - Adjusts timeout for already-elapsed time
 */
export async function restoreAgentRun(
  ctx: Context,
  manifest: AgentManifest,
  savedState: AgentState,
  deps: RestoreAgentRunDeps,
): Promise<Result<AgentRunState, AppError>> {
  const startTime = Date.now();
  const timeoutMs = manifest.config.timeout ?? DEFAULT_AGENT_TIMEOUT;

  // Deserialize messages (refresh signed URLs for binary content)
  const messagesResult = await deserializeMessages(ctx, savedState.messages, {
    storageService: deps.storageService,
    logger: deps.logger,
  });

  if (messagesResult.isErr()) {
    return err(messagesResult.error);
  }

  // Build tools (not persisted, must be rebuilt)
  const toolsResult = await buildAgentTools(ctx, manifest, {
    mcpService: deps.mcpService,
  });

  if (toolsResult.isErr()) {
    return err(toolsResult.error);
  }

  const { tools, toolsMap } = toolsResult.value;

  return ok({
    startTime,
    timeoutMs,
    tools,
    toolsMap,
    messages: messagesResult.value,
    steps: savedState.steps,
    stepNumber: savedState.currentStepNumber,
    outputValidationRetries: 0, // Reset on continue
  });
}
