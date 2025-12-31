import zod from 'zod';
import { type AgentId, agentIdSchema } from './AgentId';

/**
 * A manifest key uniquely identifies a manifest by its id and version.
 * Format: "id:version" (e.g., "browser-agent:1.0.0")
 *
 * This is a branded type - use ManifestKey() to create instances.
 */
export type ManifestKey = string & zod.BRAND<'ManifestKey'>;

export const manifestKeySchema = zod
  .string()
  .min(1, 'ManifestKey must not be empty')
  .brand<'ManifestKey'>()
  .describe('A unique identifier for a manifest (id:version)');

/**
 * Creates a ManifestKey from a manifest config or sub-agent reference.
 *
 * @example
 * // From manifest config
 * const key = ManifestKey(manifest.config);
 *
 * // From sub-agent reference
 * const key = ManifestKey({ id: subAgentConfig.manifestId, version: subAgentConfig.manifestVersion });
 */
export const ManifestKey = (config: {
  id: AgentId;
  version: string;
}): ManifestKey => {
  // biome-ignore lint: Required for branded type factory pattern
  return `${config.id}:${config.version}` as ManifestKey;
};

/**
 * Schema for validating sub-agent reference objects that can be converted to ManifestKey.
 */
export const manifestRefSchema = zod.strictObject({
  manifestId: agentIdSchema,
  manifestVersion: zod.string().min(1),
});

export type ManifestRef = zod.infer<typeof manifestRefSchema>;
