import type {
  AgentManifest,
  AgentState,
  ContinuableStateStatus,
} from '@backend/agents/domain';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

/**
 * Validates agent state matches expected criteria.
 *
 * Checks:
 * - State status matches expected
 * - Manifest ID and version match
 *
 * Returns AppError if validation fails.
 */
export function validateAgentState(
  state: AgentState,
  manifest: AgentManifest,
  expectedStatus: ContinuableStateStatus,
): Result<void, AppError> {
  // 1. Validate state status matches expected
  if (state.status !== expectedStatus) {
    const actionName = expectedStatus === 'completed' ? 'reply to' : 'continue';
    return err(
      badRequest(
        `Cannot ${actionName} agent with status: ${state.status}. Expected status: ${expectedStatus}.`,
        {
          metadata: { stateId: state.id, status: state.status, expectedStatus },
        },
      ),
    );
  }

  // 2. Validate manifest version matches
  if (
    state.manifestId !== manifest.config.id ||
    state.manifestVersion !== manifest.config.version
  ) {
    return err(
      badRequest('Manifest version mismatch', {
        metadata: {
          stateId: state.id,
          expectedManifestId: state.manifestId,
          expectedVersion: state.manifestVersion,
          providedManifestId: manifest.config.id,
          providedVersion: manifest.config.version,
        },
      }),
    );
  }

  return ok(undefined);
}
