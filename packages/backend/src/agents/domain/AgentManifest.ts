import type { AgentManifestConfig } from '@core/domain/agents';
import type { AgentManifestHooks } from '../hooks/AgentManifestHooks';

/**
 * An agent manifest with hooks (backend-specific).
 * Combines the serializable config from core with runtime hooks.
 *
 * This is the backend version of AgentManifest that uses the full
 * hook types with Context parameters and Result returns.
 */
export interface AgentManifest {
  readonly config: AgentManifestConfig;
  readonly hooks?: Partial<AgentManifestHooks>;
}
