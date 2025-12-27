import type {
  AgentState,
  ContinuableStateStatus,
  StateDeps,
} from '@backend/agents/domain';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentManifest, AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { notFound } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { validateAgentState } from '../validation/validateAgentState';
import { getAgentState } from './getAgentState';

/**
 * Loads and validates agent state in one operation.
 *
 * This is a convenience helper that combines:
 * 1. getAgentState() - Load from cache
 * 2. validateAgentState() - Validate status and manifest
 *
 * Common pattern used by prepare functions.
 *
 * Caller is responsible for:
 * - Logging success/errors
 */
export async function loadAndValidateState(
  ctx: Context,
  stateId: AgentRunId,
  manifest: AgentManifest,
  expectedStatus: ContinuableStateStatus,
  deps: StateDeps,
): Promise<Result<AgentState, AppError>> {
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

  // 2. Validate state status and manifest
  const validationResult = validateAgentState(
    savedState,
    manifest,
    expectedStatus,
  );
  if (validationResult.isErr()) {
    return err(validationResult.error);
  }

  return ok(savedState);
}
