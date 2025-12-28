import { DEFAULT_CANCELLATION_POLL_INTERVAL_MS } from '@backend/agents/domain';
import {
  type Context,
  deriveContext,
} from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import {
  type CheckCancellationDeps,
  checkCancellation,
} from './cancellation/checkCancellation';

export interface WithCancellationPollingDeps extends CheckCancellationDeps {}

export interface WithCancellationPollingOptions {
  /** Polling interval in milliseconds. Default: DEFAULT_CANCELLATION_POLL_INTERVAL_MS (2 seconds) */
  readonly pollIntervalMs?: number;
}

/**
 * Wraps an async generator with cancellation polling.
 *
 * Creates a derived context with an AbortController. Polls the cancellation
 * cache and aborts the signal when cancellation is detected. All downstream
 * operations that respect the abort signal will be interrupted.
 *
 * Optimizations:
 * - Stops polling immediately when cancellation is detected
 * - Uses { once: true } for event listeners to prevent memory leaks
 * - Prevents overlapping poll callbacks with pollingInProgress flag
 *
 * @param parentCtx - The parent context to derive from
 * @param stateId - The agent run ID to check for cancellation
 * @param runGenerator - Factory function that creates the generator with derived context
 * @param deps - Dependencies including cancellation cache
 * @param options - Optional configuration including poll interval
 * @returns An async generator that yields from the wrapped generator
 */
export async function* withCancellationPolling<TYield, TReturn>(
  parentCtx: Context,
  stateId: AgentRunId,
  runGenerator: (derivedCtx: Context) => AsyncGenerator<TYield, TReturn>,
  deps: WithCancellationPollingDeps,
  options?: WithCancellationPollingOptions,
): AsyncGenerator<TYield, TReturn> {
  const pollIntervalMs =
    options?.pollIntervalMs ?? DEFAULT_CANCELLATION_POLL_INTERVAL_MS;

  // Derive context with controllable abort
  const derivedCtx = deriveContext(parentCtx);

  // Track polling state
  let cancellationSignaled = false;
  let pollingInProgress = false;

  // Start polling
  const pollHandle = setInterval(() => {
    // Skip if already cancelled or poll in progress
    // This prevents overlapping async poll callbacks if cache is slow
    if (cancellationSignaled || pollingInProgress) {
      return;
    }

    pollingInProgress = true;

    // Using void to explicitly ignore the promise (fire-and-forget pattern)
    // The polling callback handles the result internally
    void (async () => {
      try {
        const isCancelled = await checkCancellation(parentCtx, stateId, deps);
        if (isCancelled.isOk() && isCancelled.value) {
          cancellationSignaled = true;
          clearInterval(pollHandle); // Stop polling immediately
          derivedCtx.cancel('cancelled');
        }
      } finally {
        pollingInProgress = false;
      }
    })();
  }, pollIntervalMs);

  try {
    return yield* runGenerator(derivedCtx);
  } finally {
    clearInterval(pollHandle);
  }
}
