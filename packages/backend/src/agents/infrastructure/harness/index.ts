/**
 * Tool execution harness module.
 *
 * Provides composable tool execution with middleware support:
 * - Harness: Wraps tool executors with middleware chains
 * - Middleware: Retry, timeout, and custom behavior injection
 *
 * The harness pattern allows cross-cutting concerns (retries, timeouts)
 * to be applied consistently across all tool executions.
 *
 * @module agents/infrastructure/harness
 */

export { buildStreamingToolExecutionHarness } from './buildStreamingToolExecutionHarness';
export { buildToolExecutionHarness } from './buildToolExecutionHarness';
export { createBaseToolExecutor } from './createBaseToolExecutor';
export { createStreamingBaseToolExecutor } from './createStreamingBaseToolExecutor';
export {
  createStreamingToolExecutionHarness,
  type StreamingToolExecutionHarness,
} from './createStreamingToolExecutionHarness';
export {
  createToolExecutionHarness,
  type ToolExecutionHarness,
} from './createToolExecutionHarness';
