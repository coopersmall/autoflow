import {
  type AgentRunOptions,
  type AgentRunState,
  type AgentState,
  DEFAULT_AGENT_TIMEOUT,
} from '@backend/agents/domain';
import type { SerializationDeps } from '@backend/agents/domain/dependencies';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentManifest, AgentTool } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { deserializeMessages } from '../serialization/deserializeMessages';

/**
 * Restores agent run state from saved state (for continueAgent).
 *
 * Tools are passed in (already built by caller).
 * Deserializes messages (refreshes binary content URLs).
 *
 * Used when:
 * - Replying to a completed agent
 * - Continuing from an approval
 * - Resuming from a suspension
 */
export async function restoreAgentRun(
  ctx: Context,
  manifest: AgentManifest,
  savedState: AgentState,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
  deps: SerializationDeps,
  options?: AgentRunOptions,
): Promise<Result<AgentRunState, AppError>> {
  const startTime = Date.now();
  const timeoutMs =
    manifest.config.timeout ?? options?.agentTimeout ?? DEFAULT_AGENT_TIMEOUT;

  // Deserialize messages (refresh signed URLs for binary content)
  const messagesResult = await deserializeMessages(
    ctx,
    savedState.messages,
    deps,
    options,
  );

  if (messagesResult.isErr()) {
    return err(messagesResult.error);
  }

  return ok({
    runId: savedState.id, // Use existing state ID
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
