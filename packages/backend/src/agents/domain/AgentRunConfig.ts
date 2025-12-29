import type { AgentId } from '@core/domain/agents';
import type { AgentObserver } from '../observers/AgentObserver';
import type { AgentManifest } from './AgentManifest';

/**
 * Configuration for running an agent.
 *
 * Note: Hooks are defined on each AgentManifest, not here.
 * This keeps serializable config (AgentManifest.config) separate from
 * runtime functions (AgentManifest.hooks).
 */
export type AgentRunConfig = {
  rootManifestId: AgentId;
  manifests: AgentManifest[];

  /**
   * Optional observers applied to all manifests.
   * Observers are stateless factories - create fresh instances for each run.
   *
   * Example:
   * ```typescript
   * const { observer, conversationId } = await createConversationObserver(ctx, config);
   * const runConfig = { rootManifestId, manifests, observers: [observer] };
   * ```
   */
  observers?: AgentObserver[];
};
