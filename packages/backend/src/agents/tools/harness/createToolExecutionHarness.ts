import type {
  ToolExecutionMiddleware,
  ToolExecutor,
} from '@core/domain/agents';

export interface ToolExecutionHarness {
  execute: ToolExecutor;
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

  return { execute: composedExecutor };
}
