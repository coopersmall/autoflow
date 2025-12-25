import type { AgentState, AgentStateStatus } from '@backend/agents/domain';
import type { IAgentStateCache } from '@backend/agents/infrastructure/cache';
import type { ILogger } from '@backend/infrastructure';
import type { Context } from '@backend/infrastructure/context/Context';
import type { IStorageService } from '@backend/storage/domain/StorageService';
import {
  type AgentManifest,
  AgentRunId,
  type ToolApprovalSuspension,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { serializeMessages } from '../../serialization/serializeMessages';
import type { AgentLoopResult } from './executeAgentLoop';

export interface SaveAgentStateDeps {
  readonly storageService: IStorageService;
  readonly logger: ILogger;
  readonly stateCache: IAgentStateCache;
}

export interface SaveAgentStateParams {
  readonly ctx: Context;
  readonly manifest: AgentManifest;
  readonly loopResult: AgentLoopResult;
  readonly context?: Record<string, unknown>;
  readonly previousElapsedMs?: number;
}

/**
 * Saves agent state to cache.
 *
 * This function handles persistence for all agent outcomes:
 * - complete: Final successful state
 * - suspended: Paused for tool approval
 * - error: Failed execution
 *
 * Returns the AgentStateId for the saved state.
 */
export async function saveAgentState(
  params: SaveAgentStateParams,
  deps: SaveAgentStateDeps,
): Promise<Result<AgentRunId, AppError>> {
  const { ctx, manifest, loopResult, context, previousElapsedMs = 0 } = params;

  // Calculate total elapsed time
  const currentElapsedMs = Date.now() - loopResult.finalState.startTime;
  const totalElapsedMs = previousElapsedMs + currentElapsedMs;

  // Serialize messages (upload binary content to storage)
  const serializeResult = await serializeMessages(
    ctx,
    loopResult.finalState.messages,
    {
      storageService: deps.storageService,
      logger: deps.logger,
    },
  );

  if (serializeResult.isErr()) {
    return err(serializeResult.error);
  }

  const stateId = AgentRunId();
  const now = new Date();

  // Determine status and suspensions based on loop result
  let status: AgentStateStatus;
  let suspensions: ToolApprovalSuspension[] = [];

  if (loopResult.status === 'complete') {
    status = 'completed';
  } else if (loopResult.status === 'suspended') {
    status = 'suspended';
    suspensions = loopResult.suspensions;
  } else {
    status = 'failed';
  }

  const agentState: AgentState = {
    id: stateId,
    rootManifestId: manifest.config.id, // For now, root = current manifest (Phase 5 will handle nested)
    manifestId: manifest.config.id,
    manifestVersion: manifest.config.version,
    messages: serializeResult.value,
    steps: loopResult.finalState.steps,
    currentStepNumber: loopResult.finalState.stepNumber,
    suspensions,
    status,
    context,
    createdAt: now,
    updatedAt: now,
    elapsedExecutionMs: totalElapsedMs,
    childStateIds: [],
    schemaVersion: 1,
  };

  const setResult = await deps.stateCache.set(ctx, stateId, agentState);
  if (setResult.isErr()) {
    return err(setResult.error);
  }

  deps.logger.info('Agent state saved', {
    stateId,
    manifestId: manifest.config.id,
    status,
    elapsedMs: totalElapsedMs,
  });

  return ok(stateId);
}
