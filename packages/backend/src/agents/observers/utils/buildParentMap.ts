import {
  type AgentId,
  ManifestKey as createManifestKey,
  type ManifestKey,
} from '@core/domain/agents';
import type { AgentManifest } from '../../domain/AgentManifest';

/**
 * Builds a map from child ManifestKey to parent AgentId.
 * Used to provide parentManifestId context when applying observers.
 *
 * Traverses each manifest's subAgents config to establish parent-child relationships.
 */
export function buildParentMap(
  manifests: readonly AgentManifest[],
): Map<ManifestKey, AgentId> {
  const parentMap = new Map<ManifestKey, AgentId>();

  for (const manifest of manifests) {
    const subAgents = manifest.config.subAgents ?? [];

    for (const subAgentConfig of subAgents) {
      const childKey = createManifestKey({
        id: subAgentConfig.manifestId,
        version: subAgentConfig.manifestVersion,
      });
      parentMap.set(childKey, manifest.config.id);
    }
  }

  return parentMap;
}
