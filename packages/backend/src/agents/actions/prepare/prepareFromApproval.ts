import type {
  AgentManifest,
  AgentRunOptions,
  PrepareDeps,
} from '@backend/agents/domain';
import type { PrepareResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentRunId,
  AgentTool,
  ContinueResponse,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { badRequest, notFound } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { restoreAgentRun } from '../initialize/restoreAgentRun';
import { buildToolApprovalResponseMessage } from '../messages/buildToolApprovalResponseMessage';
import { getAgentState } from '../state/getAgentState';
import { validateAgentState } from '../validation/validateAgentState';

/**
 * Prepares agent run state from an approval response.
 * Loads the suspended state, validates the approval ID, and either:
 * - Returns 'already-running' if agent is currently executing
 * - Returns 'delegate' for suspension stacks (nested sub-agent)
 * - Returns 'continue' for flat HITL (current agent's own suspension)
 *
 * Uses EXISTING stateId from savedState.id.
 * Tools are pre-built and passed in.
 */
export async function prepareFromApproval(
  ctx: Context,
  manifest: AgentManifest,
  stateId: AgentRunId,
  response: ContinueResponse,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
  deps: Pick<PrepareDeps, 'stateCache' | 'storageService' | 'logger'>,
  options?: AgentRunOptions,
): Promise<Result<PrepareResult, AppError>> {
  // 1. Load saved state from cache
  const stateResult = await getAgentState(ctx, stateId, deps);
  if (stateResult.isErr()) {
    return err(stateResult.error);
  }

  const savedState = stateResult.value;
  if (!savedState) {
    return err(
      notFound('Agent state not found', {
        metadata: { stateId },
      }),
    );
  }

  // 2. Check if agent is already running - return early without error
  if (savedState.status === 'running') {
    return ok({
      type: 'already-running',
      runId: stateId,
    });
  }

  // 3. Validate state status and manifest
  const validationResult = validateAgentState(
    savedState,
    manifest,
    'suspended',
  );
  if (validationResult.isErr()) {
    return err(validationResult.error);
  }

  // 4. Check if this is a nested sub-agent suspension (has a matching stack)
  const matchingStack = savedState.suspensionStacks.find(
    (stack) => stack.leafSuspension.approvalId === response.approvalId,
  );

  if (matchingStack) {
    // This is a nested sub-agent suspension - delegate to resumeFromSuspensionStack
    return ok({
      type: 'delegate',
      savedState,
      matchingStack,
      response,
    });
  }

  // 5. Otherwise, handle as flat HITL (current agent's own suspension)
  const matchingSuspension = savedState.suspensions.find(
    (s) => s.approvalId === response.approvalId,
  );
  if (!matchingSuspension) {
    return err(
      badRequest('Approval ID does not match any pending suspension', {
        metadata: {
          stateId,
          providedApprovalId: response.approvalId,
          pendingSuspensions: savedState.suspensions.map((s) => s.approvalId),
          pendingStacks: savedState.suspensionStacks.map(
            (s) => s.leafSuspension.approvalId,
          ),
        },
      }),
    );
  }

  // 6. Restore agent run state (deserialize messages, use pre-built tools)
  const restoreResult = await restoreAgentRun(
    ctx,
    manifest,
    savedState,
    tools,
    toolsMap,
    {
      storageService: deps.storageService,
      logger: deps.logger,
    },
    options,
  );

  if (restoreResult.isErr()) {
    return err(restoreResult.error);
  }

  const state = restoreResult.value;

  // 7. Add approval response to messages
  const approvalMessage = buildToolApprovalResponseMessage(response);
  state.messages = [...state.messages, approvalMessage];

  return ok({
    type: 'continue', // Signals: UPDATE existing state to running
    stateId: savedState.id, // Use EXISTING stateId
    state,
    context: savedState.context,
    previousElapsedMs: savedState.elapsedExecutionMs,
    parentContext: savedState.parentContext,
    resolvedSuspensions: [matchingSuspension],
  });
}
