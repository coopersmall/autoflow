import type { AgentManifest } from '@backend/agents/domain';
import { ManifestKey } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { notFound } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

/**
 * Validates that all sub-agents referenced in a manifest exist in the manifests array.
 * Returns an error if any sub-agent reference is missing.
 */
export function validateSubAgentReferences(
  manifest: AgentManifest,
  manifestMap: Map<ManifestKey, AgentManifest>,
): Result<void, AppError> {
  if (!manifest.config.subAgents || manifest.config.subAgents.length === 0) {
    return ok(undefined);
  }

  const missingRefs: string[] = [];

  for (const subAgentConfig of manifest.config.subAgents) {
    const key = ManifestKey({
      id: subAgentConfig.manifestId,
      version: subAgentConfig.manifestVersion,
    });
    if (!manifestMap.has(key)) {
      missingRefs.push(key);
    }
  }

  if (missingRefs.length > 0) {
    return err(
      notFound('Sub-agent manifest references not found', {
        metadata: {
          manifestId: manifest.config.id,
          manifestVersion: manifest.config.version,
          missingReferences: missingRefs,
        },
      }),
    );
  }

  return ok(undefined);
}
