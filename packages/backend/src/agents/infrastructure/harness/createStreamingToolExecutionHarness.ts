import type {
  StreamingToolExecutionMiddleware,
  StreamingToolExecutor,
} from '@core/domain/agents';

/**
 * A streaming harness that wraps a tool executor with composed middleware.
 * Provides a single execute method that runs the tool through the middleware chain,
 * yielding events as they are produced.
 */
export interface StreamingToolExecutionHarness {
  /** Execute a tool call through the middleware chain, yielding events */
  readonly execute: StreamingToolExecutor;
}

/**
 * Creates a streaming tool execution harness by composing middleware around a base executor.
 * Middleware is applied in order: first middleware is outermost (runs first and last).
 *
 * The streaming harness differs from the non-streaming harness in that:
 * - The executor is an async generator that yields events
 * - Middleware can transform, filter, or add events during execution
 * - The final result is returned when the generator completes
 */
export function createStreamingToolExecutionHarness(
  baseExecutor: StreamingToolExecutor,
  middleware: StreamingToolExecutionMiddleware[],
): StreamingToolExecutionHarness {
  const composedExecutor = middleware.reduceRight(
    (executor, mw) => mw(executor),
    baseExecutor,
  );

  return Object.freeze({ execute: composedExecutor });
}
