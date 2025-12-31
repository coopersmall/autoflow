import type {
  AgentManifest,
  AgentRunOptions,
  AgentState,
  LoggingDeps,
  ParentAgentContext,
  StateDeps,
  StorageDeps,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import type { Message } from '@core/domain/ai';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import { serializeMessages } from '../serialization/serializeMessages';

export interface CreateAgentStateDeps
  extends StateDeps,
    StorageDeps,
    LoggingDeps {}

export interface CreateAgentStateParams {
  readonly ctx: Context;
  readonly stateId: AgentRunId;
  readonly manifest: AgentManifest;
  readonly messages: Message[];
  readonly context?: Record<string, unknown>;
  readonly parentContext?: ParentAgentContext;
}

/**
 * Creates a new agent state with 'running' status.
 *
 * This is called at the START of execution to create the initial state
 * before the loop begins. The state is persisted to enable:
 * - Running state visibility
 * - Crash recovery (future)
 *
 * Responsibilities:
 * - Serializes messages (uploads binary content to storage)
 * - Creates state with 'running' status
 * - Sets startedAt timestamp for crash detection
 * - Saves to cache
 *
 * Caller is responsible for:
 * - Generating the stateId (only in prepareFromRequest)
 * - Logging success/errors
 */
export async function createAgentState(
  params: CreateAgentStateParams,
  deps: CreateAgentStateDeps,
  options?: AgentRunOptions,
): Promise<Result<void, AppError>> {
  const { ctx, stateId, manifest, messages, context, parentContext } = params;

  // Serialize messages for crash recovery
  const serializeResult = await serializeMessages(ctx, messages, deps, options);
  if (serializeResult.isErr()) {
    return err(serializeResult.error);
  }

  const now = new Date();

  const agentState: AgentState = {
    id: stateId,
    rootManifestId: manifest.config.id,
    manifestId: manifest.config.id,
    manifestVersion: manifest.config.version,
    parentContext,
    messages: serializeResult.value,
    steps: [],
    currentStepNumber: 0,
    suspensions: [],
    suspensionStacks: [],
    pendingToolResults: [],
    status: 'running',
    startedAt: now, // For crash detection
    context,
    createdAt: now,
    updatedAt: now,
    elapsedExecutionMs: 0,
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
