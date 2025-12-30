import { DEFAULT_CANCELLATION_POLL_INTERVAL_MS } from '@backend/agents/domain';
import {
  type Context,
  deriveContext,
} from '@backend/infrastructure/context/Context';
import type { AgentRunId } from '@core/domain/agents';
import type { AppError } from '@core/errors/AppError';
import { err, type Result } from 'neverthrow';
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
 * If cancellation polling encounters an error (e.g., cache unavailable), the
 * error is propagated to the caller and the agent execution is stopped.
 *
 * Optimizations:
 * - Stops polling immediately when cancellation is detected or on error
 * - Prevents overlapping poll callbacks with pollingInProgress flag
 *
 * @param parentCtx - The parent context to derive from
 * @param stateId - The agent run ID to check for cancellation
 * @param runGenerator - Factory function that creates the generator with derived context
 * @param deps - Dependencies including cancellation cache
 * @param options - Optional configuration including poll interval
 * @returns An async generator that yields from the wrapped generator, or returns an error if polling fails
 */
export async function* withCancellationPolling<TYield, TReturn>(
  parentCtx: Context,
  stateId: AgentRunId,
  runGenerator: (
    derivedCtx: Context,
  ) => AsyncGenerator<TYield, Result<TReturn, AppError>>,
  deps: WithCancellationPollingDeps,
  options?: WithCancellationPollingOptions,
): AsyncGenerator<TYield, Result<TReturn, AppError>> {
  const pollIntervalMs =
    options?.pollIntervalMs ?? DEFAULT_CANCELLATION_POLL_INTERVAL_MS;

  // Derive context with controllable abort
  const derivedCtx = deriveContext(parentCtx);

  // Track polling state
  let cancellationSignaled = false;
  let pollingInProgress = false;
  let pollingError: AppError | null = null;

  // Start polling
  const pollHandle = setInterval(() => {
    // Skip if already cancelled, errored, or poll in progress
    if (cancellationSignaled || pollingError || pollingInProgress) {
      return;
    }

    pollingInProgress = true;

    void (async () => {
      try {
        const isCancelled = await checkCancellation(parentCtx, stateId, deps);
        if (isCancelled.isErr()) {
          // Store the error - generator will check this and return it
          pollingError = isCancelled.error;
          clearInterval(pollHandle);
          derivedCtx.cancel('polling-error');
          return;
        }
        if (isCancelled.value) {
          cancellationSignaled = true;
          clearInterval(pollHandle);
          derivedCtx.cancel('cancelled');
        }
      } finally {
        pollingInProgress = false;
      }
    })();
  }, pollIntervalMs);

  try {
    const generator = runGenerator(derivedCtx);

    while (true) {
      // Check for polling error before each iteration
      if (pollingError) {
        return err(pollingError);
      }

      const next = await generator.next();

      // Check again after async operation
      if (pollingError) {
        return err(pollingError);
      }

      if (next.done) {
        return next.value;
      }

      yield next.value;
    }
  } finally {
    clearInterval(pollHandle);
  }
}
