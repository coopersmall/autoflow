import type { AgentManifest, SuspensionStackEntry } from '@core/domain/agents';

/**
 * Looks up a manifest from the map.
 */
export function lookupManifest(
  entry: SuspensionStackEntry,
  manifestMap: Map<string, AgentManifest>,
): AgentManifest | undefined {
  const key = `${entry.manifestId}:${entry.manifestVersion}`;
  return manifestMap.get(key);
}
