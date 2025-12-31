import type {
  AgentManifest,
  AgentRunOptions,
  AgentState,
  AgentStateStatus,
  LoggingDeps,
  StateDeps,
  StorageDeps,
} from '@backend/agents/domain';
import type { LoopResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentRunId,
  SuspensionStack,
  ToolApprovalSuspension,
} from '@core/domain/agents';
import type { RequestToolResultPart } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { buildSuspensionStacks } from '../loop/buildSuspensionStacks';
import { serializeMessages } from '../serialization/serializeMessages';

export interface FinalizeAgentStateDeps
  extends StateDeps,
    StorageDeps,
    LoggingDeps {}

export interface FinalizeAgentStateParams {
  readonly ctx: Context;
  readonly stateId: AgentRunId; // Required, not generated
  readonly manifest: AgentManifest;
  readonly loopResult: LoopResult;
  readonly context?: Record<string, unknown>;
  readonly previousElapsedMs?: number;
}

/**
 * Finalizes agent state from loop result and saves to cache.
 *
 * This is called at the END of execution to update the running state
 * with final status, messages, and suspension info.
 *
 * Responsibilities:
 * - Serializes messages (uploads binary content to storage)
 * - Builds suspension stacks from sub-agent branches
 * - Calculates elapsed time
 * - Updates existing state with final status
 * - Saves to cache
 *
 * Caller is responsible for:
 * - Providing the stateId (from prepare functions)
 * - Logging success/errors
 */
export async function finalizeAgentState(
  params: FinalizeAgentStateParams,
  deps: FinalizeAgentStateDeps,
  options?: AgentRunOptions,
): Promise<Result<void, AppError>> {
  const {
    ctx,
    stateId,
    manifest,
    loopResult,
    context,
    previousElapsedMs = 0,
  } = params;

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

  const now = new Date();

  // Try to get existing state to preserve createdAt
  const existingStateResult = await deps.stateCache.get(ctx, stateId);
  const createdAt = existingStateResult.isOk()
    ? existingStateResult.value.createdAt
    : now;

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
  } else if (loopResult.status === 'cancelled') {
    status = 'cancelled';
  } else {
    // loopResult.status === 'error'
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
    createdAt, // Preserved from existing state if available, otherwise now
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

  return ok(undefined);
}
