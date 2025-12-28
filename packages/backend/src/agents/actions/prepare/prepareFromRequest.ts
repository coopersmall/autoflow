import type { AgentRunOptions } from '@backend/agents/domain';
import type { PrepareResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import {
  type AgentManifest,
  type AgentRequest,
  AgentRunId,
  type AgentTool,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { ok, type Result } from 'neverthrow';
import { initializeAgentRun } from '../initialize/initializeAgentRun';

/**
 * Prepares agent run state from a fresh request.
 * Generates a NEW stateId - this is the ONLY prepare function that creates new IDs.
 * Tools are pre-built and passed in.
 */
export function prepareFromRequest(
  _ctx: Context,
  manifest: AgentManifest,
  request: AgentRequest,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
  options?: AgentRunOptions,
): Result<PrepareResult, AppError> {
  // Generate NEW stateId - only prepareFromRequest does this
  const stateId = AgentRunId();

  const state = initializeAgentRun(
    stateId,
    manifest,
    request,
    tools,
    toolsMap,
    options,
  );
  const context = 'context' in request ? request.context : undefined;

  return ok({
    type: 'start', // Signals: CREATE new running state
    stateId,
    state,
    context,
    previousElapsedMs: 0,
  });
}
