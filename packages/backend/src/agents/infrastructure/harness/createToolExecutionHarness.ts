import type {
  ToolExecutionMiddleware,
  ToolExecutor,
} from '@core/domain/agents';

/**
 * A harness that wraps a tool executor with composed middleware.
 * Provides a single execute method that runs the tool through the middleware chain.
 */
export interface ToolExecutionHarness {
  /** Execute a tool call through the middleware chain */
  readonly execute: ToolExecutor;
}

/**
 * Creates a tool execution harness by composing middleware around a base executor.
 * Middleware is applied in order: first middleware is outermost (runs first and last).
 */
export function createToolExecutionHarness(
  baseExecutor: ToolExecutor,
  middleware: ToolExecutionMiddleware[],
): ToolExecutionHarness {
  const composedExecutor = middleware.reduceRight(
    (executor, mw) => mw(executor),
    baseExecutor,
  );

  return Object.freeze({ execute: composedExecutor });
}
