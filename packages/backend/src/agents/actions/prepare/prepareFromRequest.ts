import type { AgentRunOptions } from '@backend/agents/domain';
import type { PrepareResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentManifest,
  AgentRequest,
  AgentTool,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';
import { initializeAgentRun } from '../initialize/initializeAgentRun';

/**
 * Prepares agent run state from a fresh request.
 * Tools are pre-built and passed in.
 */
export function prepareFromRequest(
  ctx: Context,
  manifest: AgentManifest,
  request: AgentRequest,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
  options?: AgentRunOptions,
): Result<PrepareResult, AppError> {
  const state = initializeAgentRun(manifest, request, tools, toolsMap, options);

  return ok({
    type: 'ready',
    state,
    context: request.context,
    previousElapsedMs: 0,
  });
}
