import type { AgentId } from '../AgentId';
import type { AgentManifest } from '../config/AgentManifest';

export type AgentRunConfig = {
  rootManifestId: AgentId;
  manifests: AgentManifest[];
};
