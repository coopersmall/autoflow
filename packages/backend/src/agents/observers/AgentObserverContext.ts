import type { AgentId } from '@core/domain/agents';

/**
 * Context provided to observers when createHooks() is called.
 */
export interface AgentObserverContext {
  readonly manifestId: AgentId;
  readonly manifestVersion: string;
  readonly parentManifestId: AgentId | undefined;
  readonly isRoot: boolean;
}
