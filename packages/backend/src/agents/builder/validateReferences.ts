import type { AgentManifest } from '@autoflow/core';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';
import { detectCircularReferences } from './detectCircularReferences';

export function validateReferences(
  manifests: AgentManifest[],
): Result<void, AppError> {
  const manifestMap = new Map<string, AgentManifest>();

  // Check for duplicate manifests (same ID + version)
  for (const m of manifests) {
    const key = `${m.config.id}:${m.config.version}`;

    if (manifestMap.has(key)) {
      return err(
        badRequest(`Duplicate manifest: "${key}" is provided multiple times`, {
          metadata: {
            manifestId: m.config.id,
            manifestVersion: m.config.version,
          },
        }),
      );
    }

    manifestMap.set(key, m);
  }

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
      const key = `${subAgent.manifestId}:${subAgent.manifestVersion}`;
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
  const circularResult = detectCircularReferences(manifests, manifestMap);
  if (circularResult.isErr()) {
    return err(circularResult.error);
  }

  return ok(undefined);
}
