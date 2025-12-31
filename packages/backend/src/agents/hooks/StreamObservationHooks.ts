import type { AgentEvent } from '@core/domain/agents';
import type { LifecycleHook } from './LifecycleHook';

/**
 * Stream observation hooks - observe streaming events.
 *
 * IMPORTANT: Observers receive ALL events, not filtered by allowedEventTypes.
 * This is intentional - allowedEventTypes filters what external consumers receive,
 * but observers are internal and may need full visibility for tracking/metrics.
 *
 * If an observer only cares about certain events, it should filter internally.
 */
export interface StreamObservationHooks {
  /**
   * Called for each stream event when emitStreamEvents is true.
   * Returns Result - errors abort the run.
   */
  readonly onStreamEvent?: LifecycleHook<AgentEvent>;
}
