import type { AgentManifest } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import { buildManifestMap } from '../utils/buildManifestMap';
import { validateCircularReferences } from './validateCircularDependencies';
import { validateSubAgentReferences } from './validateSubAgentReferences';

/**
 * Validates an agent configuration before execution.
 *
 * This function should be called by the service layer (AgentService.run())
 * to validate the agent configuration before starting execution.
 *
 * Currently validates:
 * - Sub-agent references exist in the manifests array
 *
 * Can be extended with additional validations:
 * - Circular sub-agent dependencies
 * - Output tool configuration
 * - Tool name conflicts
 * - etc.
 */
export function validateAgentConfig(
  manifest: AgentManifest,
  manifests: AgentManifest[],
): Result<void, AppError> {
  // Build manifest map for efficient lookups
  const manifestMap = buildManifestMap(manifests);

  // Validate sub-agent references
  const subAgentValidation = validateSubAgentReferences(manifest, manifestMap);
  if (subAgentValidation.isErr()) {
    return subAgentValidation;
  }

  // Validate circular dependencies among all manifests
  const dependenciesValidation = validateCircularReferences(
    manifests,
    manifestMap,
  );

  if (dependenciesValidation.isErr()) {
    return dependenciesValidation;
  }

  // Future validations can be added here:
  // - validateCircularDependencies(manifest, manifestMap)
  // - validateToolNames(manifest)
  // - validateOutputTool(manifest)

  return subAgentValidation;
}
