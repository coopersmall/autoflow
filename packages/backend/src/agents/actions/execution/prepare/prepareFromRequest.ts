import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentManifest,
  AgentRequest,
  AgentTool,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';
import { initializeAgentRun } from '../initialize/initializeAgentRun';
import type { PrepareResult } from './PrepareResult';

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
): Result<PrepareResult, AppError> {
  const state = initializeAgentRun(manifest, request, tools, toolsMap);

  return ok({
    state,
    context: request.context,
    previousElapsedMs: 0,
  });
}
