import type { AgentRunOptions, PrepareDeps } from '@backend/agents/domain';
import type { PrepareResult } from '@backend/agents/domain/execution';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentManifest,
  AgentRunId,
  AgentTool,
  ContinueResponse,
} from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { restoreAgentRun } from '../initialize/restoreAgentRun';
import { buildToolApprovalResponseMessage } from '../messages/buildToolApprovalResponseMessage';
import { loadAndValidateState } from '../state/loadAndValidateState';

/**
 * Prepares agent run state from an approval response.
 * Loads the suspended state, validates the approval ID, and either:
 * - Returns needsResume for suspension stacks (nested sub-agent)
 * - Adds the approval response directly (flat HITL)
 *
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
  // 1. Load and validate saved state
  const stateResult = await loadAndValidateState(
    ctx,
    stateId,
    manifest,
    'suspended',
    deps,
  );

  if (stateResult.isErr()) {
    return err(stateResult.error);
  }

  const savedState = stateResult.value;

  // 2. Check if this is a nested sub-agent suspension (has a matching stack)
  const matchingStack = savedState.suspensionStacks.find(
    (stack) => stack.leafSuspension.approvalId === response.approvalId,
  );

  if (matchingStack) {
    // This is a nested sub-agent suspension - return needsResume
    // runAgent will handle the actual resume
    return ok({
      type: 'resume',
      savedState,
      matchingStack,
      response,
    });
  }

  // 3. Otherwise, handle as flat HITL (current agent's own suspension)
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

  // 4. Restore agent run state (deserialize messages, use pre-built tools)
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

  // 5. Add approval response to messages
  const approvalMessage = buildToolApprovalResponseMessage(response);
  state.messages = [...state.messages, approvalMessage];

  return ok({
    type: 'ready',
    state,
    context: savedState.context,
    previousElapsedMs: savedState.elapsedExecutionMs,
  });
}
