import type { AgentLifecycleHooks } from './AgentLifecycleHooks';
import type { StepTransformationHooks } from './StepTransformationHooks';
import type { StreamObservationHooks } from './StreamObservationHooks';
import type { SubAgentLifecycleHooks } from './SubAgentLifecycleHooks';
import type { ToolExtensionHooks } from './ToolExtensionHooks';

/**
 * Full hooks interface for agent manifests.
 *
 * ALL HOOKS RECEIVE `ctx: Context` AS FIRST PARAMETER.
 *
 * HOOK CHAINING SEMANTICS:
 *
 * Lifecycle hooks (onAgentStart, onAgentResume, onAgentComplete, etc.):
 * - Chain: observer1 -> observer2 -> ... -> manifest hook
 * - First error aborts the chain and the run
 * - onAgentStart: called for fresh starts only
 * - onAgentResume: called for resumes from suspension only
 *
 * Step transformation hooks (onStepStart):
 * - Compose: each handler can transform messages/tools
 * - Results are merged, later handlers override earlier
 *
 * Step observation hooks (onStepFinish):
 * - Chain: all handlers called, first error aborts
 *
 * Stream observation hooks (onStreamEvent):
 * - Chain: all handlers called, first error aborts
 *
 * Non-function properties (toolExecutors, subAgentMappers):
 * - Not chained - manifest values used directly
 */
export interface AgentManifestHooks
  extends StepTransformationHooks,
    ToolExtensionHooks,
    AgentLifecycleHooks,
    SubAgentLifecycleHooks,
    StreamObservationHooks {}
