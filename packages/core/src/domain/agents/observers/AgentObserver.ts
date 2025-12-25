import type { AgentManifestHooks } from '../config/AgentManifestHooks';
import type { AgentObserverContext } from './AgentObserverContext';

/**
 * An observer factory that wraps hooks with additional behavior.
 * Receives context about where this manifest sits in the hierarchy.
 */
export type AgentObserver = (
  hooks: AgentManifestHooks,
  context: AgentObserverContext,
) => AgentManifestHooks;
