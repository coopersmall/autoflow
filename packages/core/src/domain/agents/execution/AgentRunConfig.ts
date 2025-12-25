import { z as zod } from 'zod';
import { agentIdSchema } from '../AgentId';
import type { AgentManifest } from '../config/AgentManifest';
import { agentManifestConfigSchema } from '../config/AgentManifestConfig';

export const agentRunConfigSchema = zod.strictObject({
  rootManifestId: agentIdSchema.describe('ID of the root manifest to execute'),
  manifests: zod
    .array(agentManifestConfigSchema)
    .describe('Flat array of all manifests'),
});

export type AgentRunConfig = zod.infer<typeof agentRunConfigSchema>;

// Note: The full AgentRunConfig with hooks is assembled at runtime
export interface AgentRunConfigWithHooks {
  rootManifestId: zod.infer<typeof agentIdSchema>;
  manifests: AgentManifest[]; // Includes hooks
}
