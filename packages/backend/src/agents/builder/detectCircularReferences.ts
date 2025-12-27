import type { AgentId, AgentManifest } from '@autoflow/core';
import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import { err, ok, type Result } from 'neverthrow';

export function detectCircularReferences(
  manifests: AgentManifest[],
  manifestMap: Map<string, AgentManifest>,
): Result<void, AppError> {
  const visited = new Set<string>();
  const stack = new Set<string>();

  const visit = (
    manifestId: AgentId,
    version: string,
  ): Result<void, AppError> => {
    const key = `${manifestId}:${version}`;

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
