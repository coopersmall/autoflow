import {
  type AgentRunState,
  type AgentState,
  DEFAULT_AGENT_TIMEOUT,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import type {
  AgentManifest,
  AgentRequest,
  AgentTool,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { deserializeMessages } from '../../serialization/deserializeMessages';
import { buildInitialMessages } from './buildInitialMessages';

/**
 * Initializes a fresh agent run state.
 *
 * Pure function that assembles initial state from manifest and request.
 * Tools are passed in (already built by caller).
 */
export function initializeAgentRun(
  manifest: AgentManifest,
  request: AgentRequest,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
): AgentRunState {
  const startTime = Date.now();
  const timeoutMs = manifest.config.timeout ?? DEFAULT_AGENT_TIMEOUT;
  const messages = buildInitialMessages(manifest, request);

  return {
    startTime,
    timeoutMs,
    tools,
    toolsMap,
    messages,
    steps: [],
    stepNumber: 0,
    outputValidationRetries: 0,
  };
}

/**
 * Restores agent run state from saved state (for continueAgent).
 *
 * Tools are passed in (already built by caller).
 * Deserializes messages (refreshes binary content URLs).
 */
export async function restoreAgentRun(
  ctx: Context,
  manifest: AgentManifest,
  savedState: AgentState,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
  deps: { storageService: IStorageService; logger: ILogger },
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
