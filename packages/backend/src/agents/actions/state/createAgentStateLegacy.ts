import type {
  AgentRunOptions,
  AgentState,
  AgentStateStatus,
  LoggingDeps,
  StateDeps,
  StorageDeps,
} from '@backend/agents/domain';
import type { LoopResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import {
  type AgentManifest,
  AgentRunId,
  type SuspensionStack,
  type ToolApprovalSuspension,
} from '@core/domain/agents';
import type { RequestToolResultPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { buildSuspensionStacks } from '../loop/buildSuspensionStacks';
import { serializeMessages } from '../serialization/serializeMessages';

export interface CreateAgentStateLegacyDeps
  extends StateDeps,
    StorageDeps,
    LoggingDeps {}

export interface CreateAgentStateLegacyParams {
  readonly ctx: Context;
  readonly manifest: AgentManifest;
  readonly loopResult: LoopResult;
  readonly context?: Record<string, unknown>;
  readonly previousElapsedMs?: number;
}

/**
 * LEGACY: Creates a new agent state from loop result and saves to cache.
 *
 * @deprecated Use finalizeAgentState with stateId from prepare functions instead.
 * This function will be removed once the orchestration refactor is complete.
 *
 * This version generates stateId internally for backward compatibility.
 */
export async function createAgentStateLegacy(
  params: CreateAgentStateLegacyParams,
  deps: CreateAgentStateLegacyDeps,
  options?: AgentRunOptions,
): Promise<Result<AgentRunId, AppError>> {
  const { ctx, manifest, loopResult, context, previousElapsedMs = 0 } = params;

  // Calculate total elapsed time
  const currentElapsedMs = Date.now() - loopResult.finalState.startTime;
  const totalElapsedMs = previousElapsedMs + currentElapsedMs;

  // Serialize messages (upload binary content to storage)
  const serializeResult = await serializeMessages(
    ctx,
    loopResult.finalState.messages,
    deps,
    options,
  );

  if (serializeResult.isErr()) {
    return err(serializeResult.error);
  }

  const stateId = AgentRunId();
  const now = new Date();

  // Determine status, suspensions, stacks, and pending results based on loop result
  let status: AgentStateStatus;
  let suspensions: ToolApprovalSuspension[] = [];
  let suspensionStacks: SuspensionStack[] = [];
  let pendingToolResults: RequestToolResultPart[] = [];

  if (loopResult.status === 'complete') {
    status = 'completed';
  } else if (loopResult.status === 'suspended') {
    status = 'suspended';

    // Current agent's own HITL suspensions
    suspensions = loopResult.suspensions;

    // Build stacks from sub-agent branches
    if (loopResult.subAgentBranches.length > 0) {
      suspensionStacks = buildSuspensionStacks({
        manifest,
        stateId,
        branches: loopResult.subAgentBranches,
      });
    }

    // Store completed results from parallel tool calls
    pendingToolResults = loopResult.completedToolResults;
  } else {
    status = 'failed';
  }

  const agentState: AgentState = {
    id: stateId,
    rootManifestId: manifest.config.id,
    manifestId: manifest.config.id,
    manifestVersion: manifest.config.version,
    messages: serializeResult.value,
    steps: loopResult.finalState.steps,
    currentStepNumber: loopResult.finalState.stepNumber,
    suspensions,
    suspensionStacks,
    pendingToolResults,
    status,
    context,
    createdAt: now,
    updatedAt: now,
    elapsedExecutionMs: totalElapsedMs,
    childStateIds: [],
    schemaVersion: 1,
  };

  const setResult = await deps.stateCache.set(
    ctx,
    stateId,
    agentState,
    options?.agentStateTtl,
  );
  if (setResult.isErr()) {
    return err(setResult.error);
  }

  return ok(stateId);
}
