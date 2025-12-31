import type { AgentRequest, ManifestKey } from '@core/domain/agents';
import type { AgentManifest } from './AgentManifest';
import type { ParentAgentContext } from './ParentAgentContext';

/**
 * Full agent input with manifest map for sub-agent resolution.
 * This is the backend-specific type that includes the manifestMap.
 */
export type AgentInput = Readonly<
  AgentRequest & {
    manifestMap: ReadonlyMap<ManifestKey, AgentManifest>;
    /**
     * Parent context when this agent is invoked as a sub-agent.
     * Threaded through to executeAgent for hook params.
     */
    parentContext?: ParentAgentContext;
  }
>;
