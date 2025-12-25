import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentManifest, AgentRequest } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { initializeAgentRun } from '../initialize/initializeAgentRun';
import type { PrepareAgentRunDeps, PrepareResult } from './PrepareResult';

/**
 * Prepares agent run state from a fresh request.
 */
export async function prepareFromRequest(
  ctx: Context,
  manifest: AgentManifest,
  request: AgentRequest,
  deps: Pick<PrepareAgentRunDeps, 'mcpService'>,
): Promise<Result<PrepareResult, AppError>> {
  const initResult = await initializeAgentRun(ctx, manifest, request, {
    mcpService: deps.mcpService,
  });

  if (initResult.isErr()) {
    return err(initResult.error);
  }

  return ok({
    state: initResult.value,
    context: request.context,
    previousElapsedMs: 0,
  });
}
