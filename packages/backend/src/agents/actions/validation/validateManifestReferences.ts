import { ManifestKey } from '@autoflow/core';
import type { AgentManifest } from '@backend/agents/domain';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { validateCircularReferences } from './validateCircularDependencies';

/**
 * Validates manifest references for an agent run configuration.
 *
 * Checks for:
 * 1. Version conflicts (same manifest ID with different versions)
 * 2. Missing sub-agent references (sub-agent manifests not provided)
 * 3. Circular sub-agent dependencies
 *
 * @param manifests - Array of all agent manifests in the configuration
 * @param manifestMap - Map of ManifestKey to AgentManifest for efficient lookups
 * @returns Ok if valid, Err with details if any validation fails
 */
export function validateManifestReferences(
  manifests: readonly AgentManifest[],
  manifestMap: ReadonlyMap<ManifestKey, AgentManifest>,
): Result<void, AppError> {
  // Check for version conflicts (same ID, different versions)
  const idToVersions = new Map<string, string[]>();
  for (const m of manifests) {
    const versions = idToVersions.get(m.config.id) ?? [];
    versions.push(m.config.version);
    idToVersions.set(m.config.id, versions);
  }

  for (const [id, versions] of idToVersions) {
    if (versions.length > 1) {
      return err(
        badRequest(
          `Conflicting versions for manifest "${id}": ${versions.join(', ')}. Each manifest ID must have exactly one version.`,
          { metadata: { manifestId: id, versions } },
        ),
      );
    }
  }

  // Validate sub-agent references
  for (const manifest of manifests) {
    for (const subAgent of manifest.config.subAgents ?? []) {
      const key = ManifestKey({
        id: subAgent.manifestId,
        version: subAgent.manifestVersion,
      });
      if (!manifestMap.has(key)) {
        return err(
          badRequest(
            `Sub-agent "${subAgent.name}" references manifest "${key}" which is not provided`,
            {
              metadata: {
                manifestId: subAgent.manifestId,
                manifestVersion: subAgent.manifestVersion,
              },
            },
          ),
        );
      }
    }
  }

  // Check for circular references
  const circularResult = validateCircularReferences(manifests, manifestMap);
  if (circularResult.isErr()) {
    return err(circularResult.error);
  }

  return ok(undefined);
}
