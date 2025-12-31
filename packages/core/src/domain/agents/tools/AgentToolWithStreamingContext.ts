import type { Tool } from '../../ai/request/completions/tools/Tool';
import type { StreamingToolExecutor } from './StreamingToolExecutor';

/**
 * A tool that streams events during execution (e.g., sub-agent tools).
 *
 * Unlike regular tools which return a single result, streaming context tools
 * are async generators that yield events during execution. This enables:
 * - Real-time event streaming from nested sub-agents
 * - Progress updates for long-running operations
 * - Interleaved events when multiple tools run in parallel
 *
 * The harness will call executeStreamingWithContext for these tools and
 * yield all events they produce before collecting the final result.
 *
 * Used primarily for:
 * - Sub-agent tools (stream nested agent events to parent)
 * - Tools that need to emit intermediate state
 */
export type AgentToolWithStreamingContext = Tool & {
  executeStreamingWithContext: StreamingToolExecutor;
};

/**
 * Type guard to check if a tool supports streaming execution.
 *
 * Streaming tools have an executeStreamingWithContext property that returns
 * an async generator. The harness uses this to determine whether to use
 * the streaming or standard execution path.
 *
 * @param tool The tool to check
 * @returns true if the tool is an AgentToolWithStreamingContext
 */
export function isAgentToolWithStreamingContext(
  tool: unknown,
): tool is AgentToolWithStreamingContext {
  return (
    typeof tool === 'object' &&
    tool !== null &&
    'executeStreamingWithContext' in tool
  );
}
