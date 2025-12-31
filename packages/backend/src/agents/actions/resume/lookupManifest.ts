import type { AgentManifest } from '@backend/agents/domain';
import { ManifestKey, type SuspensionStackEntry } from '@core/domain/agents';

/**
 * Looks up a manifest from the map.
 */
export function lookupManifest(
  entry: SuspensionStackEntry,
  manifestMap: ReadonlyMap<ManifestKey, AgentManifest>,
): AgentManifest | undefined {
  const key = ManifestKey({
    id: entry.manifestId,
    version: entry.manifestVersion,
  });
  return manifestMap.get(key);
}
