import { type AgentId, ManifestKey } from '@autoflow/core';
import type { AgentManifest } from '@backend/agents/domain';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

/**
 * Validates that there are no circular sub-agent dependencies in the manifest graph.
 *
 * Uses depth-first search with a recursion stack to detect cycles.
 * A cycle exists if we encounter a manifest that's already in the current traversal path.
 *
 * @param manifests - Array of all agent manifests to check
 * @param manifestMap - Map of ManifestKey to AgentManifest for efficient lookups
 * @returns Ok if no cycles found, Err with the cycle-causing manifest key if a cycle is detected
 */
export function validateCircularReferences(
  manifests: readonly AgentManifest[],
  manifestMap: ReadonlyMap<ManifestKey, AgentManifest>,
): Result<void, AppError> {
  const visited = new Set<ManifestKey>();
  const stack = new Set<ManifestKey>();

  const visit = (
    manifestId: AgentId,
    version: string,
  ): Result<void, AppError> => {
    const key = ManifestKey({ id: manifestId, version });

    if (stack.has(key)) {
      return err(badRequest(`Circular sub-agent reference detected: ${key}`));
    }

    if (visited.has(key)) {
      return ok(undefined);
    }

    visited.add(key);
    stack.add(key);

    const manifest = manifestMap.get(key);
    if (manifest) {
      for (const subAgent of manifest.config.subAgents ?? []) {
        const result = visit(subAgent.manifestId, subAgent.manifestVersion);
        if (result.isErr()) return result;
      }
    }

    stack.delete(key);
    return ok(undefined);
  };

  for (const manifest of manifests) {
    const result = visit(manifest.config.id, manifest.config.version);
    if (result.isErr()) return result;
  }

  return ok(undefined);
}
