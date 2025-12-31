/**
 * Agent infrastructure module.
 *
 * Provides core infrastructure components for agent execution:
 * - Cache: State and cancellation signal storage
 * - Lock: Distributed locking for concurrent execution control
 * - Harness: Tool execution with middleware composition
 *
 * @module agents/infrastructure
 */

export {
  createAgentCancellationCache,
  createAgentStateCache,
  type IAgentCancellationCache,
  type IAgentStateCache,
} from './cache';
export {
  buildStreamingToolExecutionHarness,
  buildToolExecutionHarness,
  type StreamingToolExecutionHarness,
  type ToolExecutionHarness,
} from './harness';
export { createAgentRunLock, type IAgentRunLock } from './lock';
