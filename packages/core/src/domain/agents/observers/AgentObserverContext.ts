import type { AgentId } from '../AgentId';

export interface AgentObserverContext {
  /** The manifest being wrapped */
  readonly manifestId: AgentId;
  readonly manifestVersion: string;

  /** Parent manifest ID (undefined for root) */
  readonly parentManifestId: AgentId | undefined;

  /** Whether this is the root agent */
  readonly isRoot: boolean;
}
