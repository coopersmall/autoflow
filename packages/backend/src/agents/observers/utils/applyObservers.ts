import { type AgentId, ManifestKey } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, ok, type Result } from 'neverthrow';
import type { AgentManifest } from '../../domain/AgentManifest';
import type { AgentManifestHooks } from '../../hooks/AgentManifestHooks';
import type { AgentObserver } from '../AgentObserver';
import type { AgentObserverContext } from '../AgentObserverContext';
import { buildParentMap } from './buildParentMap';
import { chainObservationHooks } from './chainObservationHooks';
import { composeTransformationHooks } from './composeTransformationHooks';

/**
 * Result of applying observers to manifests.
 */
export interface ApplyObserversResult {
  readonly manifests: readonly AgentManifest[];
}

/**
 * Applies observers to all manifests by building hook chains.
 *
 * Returns err() if any observer's createHooks() returns err().
 * This fails the entire run - observer errors are programming errors that should
 * be surfaced immediately.
 *
 * CHAINING SEMANTICS BY HOOK TYPE:
 *
 * Lifecycle hooks (onAgentStart, onAgentResume, onAgentComplete, etc.):
 * - Chain: observer1 -> observer2 -> ... -> manifest hook
 * - First error aborts the chain and the run
 * - All return Result<void, AppError>
 *
 * Step transformation hooks (onStepStart):
 * - Compose: each handler can transform messages/tools
 * - Results are merged, later handlers override earlier
 * - Each receives transformed state from previous handler
 *
 * Step observation hooks (onStepFinish):
 * - Chain: all handlers called, first error aborts
 *
 * Non-function properties (toolExecutors, subAgentMappers):
 * - Not chained - manifest values used directly
 * - Observers cannot provide these
 */
export function applyObservers(
  manifests: readonly AgentManifest[],
  rootManifestId: AgentId,
  observers: readonly AgentObserver[],
): Result<ApplyObserversResult, AppError> {
  if (observers.length === 0) {
    return ok({ manifests });
  }

  const parentMap = buildParentMap(manifests);
  const resultManifests: AgentManifest[] = [];

  for (const manifest of manifests) {
    const key = ManifestKey(manifest.config);

    // Build context for this manifest
    const context: AgentObserverContext = {
      manifestId: manifest.config.id,
      manifestVersion: manifest.config.version,
      parentManifestId: parentMap.get(key),
      isRoot: manifest.config.id === rootManifestId,
    };

    // Collect hooks from all observers (context captured via closure)
    const allObserverHooks: Partial<AgentManifestHooks>[] = [];

    for (const observer of observers) {
      const hooksResult = observer.createHooks(context);
      if (hooksResult.isErr()) {
        // Observer returned error - fail the run
        return err(hooksResult.error);
      }
      allObserverHooks.push(hooksResult.value);
    }

    // Build chained/composed hooks
    const chainedHooks: Partial<AgentManifestHooks> = {
      // Non-function properties pass through unchanged
      toolExecutors: manifest.hooks?.toolExecutors,
      subAgentMappers: manifest.hooks?.subAgentMappers,

      // Step start uses compose pattern (transformation)
      onStepStart: composeTransformationHooks(
        allObserverHooks.map((h) => h.onStepStart),
        manifest.hooks?.onStepStart,
      ),

      // All other hooks use chain pattern (observation)
      onStepFinish: chainObservationHooks(
        allObserverHooks.map((h) => h.onStepFinish),
        manifest.hooks?.onStepFinish,
      ),
      onAgentStart: chainObservationHooks(
        allObserverHooks.map((h) => h.onAgentStart),
        manifest.hooks?.onAgentStart,
      ),
      onAgentResume: chainObservationHooks(
        allObserverHooks.map((h) => h.onAgentResume),
        manifest.hooks?.onAgentResume,
      ),
      onAgentComplete: chainObservationHooks(
        allObserverHooks.map((h) => h.onAgentComplete),
        manifest.hooks?.onAgentComplete,
      ),
      onAgentSuspend: chainObservationHooks(
        allObserverHooks.map((h) => h.onAgentSuspend),
        manifest.hooks?.onAgentSuspend,
      ),
      onAgentError: chainObservationHooks(
        allObserverHooks.map((h) => h.onAgentError),
        manifest.hooks?.onAgentError,
      ),
      onAgentCancelled: chainObservationHooks(
        allObserverHooks.map((h) => h.onAgentCancelled),
        manifest.hooks?.onAgentCancelled,
      ),
      onSubAgentStart: chainObservationHooks(
        allObserverHooks.map((h) => h.onSubAgentStart),
        manifest.hooks?.onSubAgentStart,
      ),
      onSubAgentComplete: chainObservationHooks(
        allObserverHooks.map((h) => h.onSubAgentComplete),
        manifest.hooks?.onSubAgentComplete,
      ),
      onSubAgentSuspend: chainObservationHooks(
        allObserverHooks.map((h) => h.onSubAgentSuspend),
        manifest.hooks?.onSubAgentSuspend,
      ),
      onSubAgentError: chainObservationHooks(
        allObserverHooks.map((h) => h.onSubAgentError),
        manifest.hooks?.onSubAgentError,
      ),
      onSubAgentCancelled: chainObservationHooks(
        allObserverHooks.map((h) => h.onSubAgentCancelled),
        manifest.hooks?.onSubAgentCancelled,
      ),
      onStreamEvent: chainObservationHooks(
        allObserverHooks.map((h) => h.onStreamEvent),
        manifest.hooks?.onStreamEvent,
      ),
    };

    resultManifests.push({
      config: manifest.config,
      hooks: chainedHooks,
    });
  }

  return ok({ manifests: resultManifests });
}
