import type { AgentState } from '@backend/agents/domain';
import type { IAgentStateCache } from '@backend/agents/infrastructure/cache';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentManifest, AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { badRequest, notFound } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

export type StateStatus = 'completed' | 'suspended';

/**
 * Loads agent state from cache and validates it.
 *
 * This helper extracts the common validation logic used by
 * prepareFromReply and prepareFromApproval.
 */
export async function loadAndValidateState(
  ctx: Context,
  stateId: AgentRunId,
  manifest: AgentManifest,
  expectedStatus: StateStatus,
  stateCache: IAgentStateCache,
): Promise<Result<AgentState, AppError>> {
  // 1. Load saved state from cache
  const stateResult = await stateCache.get(ctx, stateId);
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

  // 2. Validate state status matches expected
  if (savedState.status !== expectedStatus) {
    const actionName = expectedStatus === 'completed' ? 'reply to' : 'continue';
    return err(
      badRequest(
        `Cannot ${actionName} agent with status: ${savedState.status}. Expected status: ${expectedStatus}.`,
        {
          metadata: { stateId, status: savedState.status, expectedStatus },
        },
      ),
    );
  }

  // 3. Validate manifest version matches
  if (
    savedState.manifestId !== manifest.config.id ||
    savedState.manifestVersion !== manifest.config.version
  ) {
    return err(
      badRequest('Manifest version mismatch', {
        metadata: {
          stateId,
          expectedManifestId: savedState.manifestId,
          expectedVersion: savedState.manifestVersion,
          providedManifestId: manifest.config.id,
          providedVersion: manifest.config.version,
        },
      }),
    );
  }

  return ok(savedState);
}
