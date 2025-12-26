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
import { buildToolApprovalResponseMessage } from '../helpers/buildToolApprovalResponseMessage';
import { restoreAgentRun } from '../initialize/initializeAgentRun';
import { loadAndValidateState } from './loadAndValidateState';
import type { PrepareAgentRunDeps, PrepareResult } from './PrepareResult';

/**
 * Prepares agent run state from an approval response.
 * Loads the suspended state, validates the approval ID, and adds the approval response.
 * Tools are pre-built and passed in.
 */
export async function prepareFromApproval(
  ctx: Context,
  manifest: AgentManifest,
  stateId: AgentRunId,
  response: ContinueResponse,
  tools: AgentTool[],
  toolsMap: Map<string, AgentTool>,
  deps: Pick<PrepareAgentRunDeps, 'stateCache' | 'storageService' | 'logger'>,
): Promise<Result<PrepareResult, AppError>> {
  // 1. Load and validate saved state
  const stateResult = await loadAndValidateState(
    ctx,
    stateId,
    manifest,
    'suspended',
    deps.stateCache,
  );

  if (stateResult.isErr()) {
    return err(stateResult.error);
  }

  const savedState = stateResult.value;

  // 2. Validate approval ID matches one of the pending suspensions
  const matchingSuspension = savedState.suspensions.find(
    (s) => s.approvalId === response.approvalId,
  );
  if (!matchingSuspension) {
    return err(
      badRequest('Approval ID does not match any pending suspension', {
        metadata: {
          stateId,
          providedApprovalId: response.approvalId,
          pendingApprovalIds: savedState.suspensions.map((s) => s.approvalId),
        },
      }),
    );
  }

  // 3. Restore agent run state (deserialize messages, use pre-built tools)
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
  );

  if (restoreResult.isErr()) {
    return err(restoreResult.error);
  }

  const state = restoreResult.value;

  // 4. Add approval response to messages
  const approvalMessage = buildToolApprovalResponseMessage(response);
  state.messages = [...state.messages, approvalMessage];

  return ok({
    state,
    context: savedState.context,
    previousElapsedMs: savedState.elapsedExecutionMs,
  });
}
