import type { AgentManifest } from '@core/domain/agents';

/**
 * Builds a map of manifest ID:version → AgentManifest from a flat array.
 * Used for quick lookup during agent execution and sub-agent resolution.
 */
export function buildManifestMap(
  manifests: AgentManifest[],
): Map<string, AgentManifest> {
  const map = new Map<string, AgentManifest>();

  for (const manifest of manifests) {
    const key = `${manifest.config.id}:${manifest.config.version}`;
    map.set(key, manifest);
  }

  return map;
}
