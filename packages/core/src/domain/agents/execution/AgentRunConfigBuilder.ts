import type { AppError } from '@core/errors/AppError';
import { badRequest } from '@core/errors/factories';
import type { ExtractMethods } from '@core/types';
import { err, ok, type Result } from 'neverthrow';
import type { AgentId } from '../AgentId';
import type { AgentManifest } from '../config/AgentManifest';
import type { AgentRunConfigWithHooks } from './AgentRunConfig';

export type IAgentRunConfigBuilder = ExtractMethods<AgentRunConfigBuilder>;

export function createAgentRunConfigBuilder(): IAgentRunConfigBuilder {
  return new AgentRunConfigBuilder();
}

export class AgentRunConfigBuilder {
  private rootManifest: AgentManifest | null = null;
  private manifests: AgentManifest[] = [];

  withRoot(manifest: AgentManifest): this {
    this.rootManifest = manifest;
    this.manifests.push(manifest);
    return this;
  }

  withManifest(manifest: AgentManifest): this {
    this.manifests.push(manifest);
    return this;
  }

  build(): Result<AgentRunConfigWithHooks, AppError> {
    if (!this.rootManifest) {
      return err(badRequest('Root manifest is required'));
    }

    const validationResult = this.validateReferences();
    if (validationResult.isErr()) {
      return err(validationResult.error);
    }

    return ok({
      rootManifestId: this.rootManifest.config.id,
      manifests: this.manifests,
    });
  }

  private validateReferences(): Result<void, AppError> {
    const manifestMap = new Map<string, AgentManifest>();

    // Check for duplicate manifests (same ID + version)
    for (const m of this.manifests) {
      const key = `${m.config.id}:${m.config.version}`;

      if (manifestMap.has(key)) {
        return err(
          badRequest(
            `Duplicate manifest: "${key}" is provided multiple times`,
            {
              metadata: {
                manifestId: m.config.id,
                manifestVersion: m.config.version,
              },
            },
          ),
        );
      }

      manifestMap.set(key, m);
    }

    // Check for version conflicts (same ID, different versions)
    const idToVersions = new Map<string, string[]>();
    for (const m of this.manifests) {
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
    for (const manifest of this.manifests) {
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
    const circularResult = this.detectCircularReferences(manifestMap);
    if (circularResult.isErr()) {
      return err(circularResult.error);
    }

    return ok(undefined);
  }

  private detectCircularReferences(
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

    for (const manifest of this.manifests) {
      const result = visit(manifest.config.id, manifest.config.version);
      if (result.isErr()) return result;
    }

    return ok(undefined);
  }
}
