import type { AgentManifest } from '@backend/agents/domain';
import { ManifestKey } from '@core/domain/agents';

/**
 * Builds a map of ManifestKey → AgentManifest from a flat array.
 * Used for quick lookup during agent execution and sub-agent resolution.
 */
export function buildManifestMap(
  manifests: readonly AgentManifest[],
): Map<ManifestKey, AgentManifest> {
  const map = new Map<ManifestKey, AgentManifest>();

  for (const manifest of manifests) {
    const key = ManifestKey(manifest.config);
    map.set(key, manifest);
  }

  return map;
}
