import type {
  StreamingToolExecutionMiddleware,
  StreamingToolExecutor,
} from '@core/domain/agents';

export interface StreamingToolExecutionHarness {
  execute: StreamingToolExecutor;
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

  return { execute: composedExecutor };
}
