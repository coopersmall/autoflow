import type { ManifestKey } from '@autoflow/core';
import type { AgentManifest, AgentRunConfig } from '@backend/agents/domain';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { buildManifestMap } from '../utils/buildManifestMap';
import { validateManifestReferences } from './validateManifestReferences';

/**
 * Response from validating an agent run configuration.
 */
export type ValidateAgentRunConfigResult = Readonly<{
  /** The root manifest that will be executed */
  rootManifest: AgentManifest;
  /** Map of ManifestKey to AgentManifest for efficient lookups */
  manifestMap: Map<ManifestKey, AgentManifest>;
}>;

/**
 * Validates an agent run configuration before execution.
 *
 * Checks that:
 * 1. The root manifest ID exists in the provided manifests
 * 2. All manifest references are valid (no version conflicts, no missing sub-agents)
 * 3. No circular sub-agent dependencies exist
 *
 * @param config - The agent run configuration to validate
 * @returns Ok with root manifest and manifest map if valid, Err if any validation fails
 */
export function validateAgentRunConfig(
  config: AgentRunConfig,
): Result<ValidateAgentRunConfigResult, AppError> {
  const { rootManifestId, manifests } = config;

  const rootManifest = manifests.find((m) => m.config.id === rootManifestId);
  if (!rootManifest) {
    return err(
      badRequest('Root manifest not found in provided manifests', {
        metadata: { rootManifestId },
      }),
    );
  }

  const manifestMap = buildManifestMap(manifests);
  const validationResult = validateManifestReferences(manifests, manifestMap);
  if (validationResult.isErr()) {
    return err(validationResult.error);
  }

  return ok({
    rootManifest,
    manifestMap,
  });
}
