import {
  AgentToolResult,
  isAgentToolWithContext,
  isAgentToolWithStreamingContext,
  type StreamingToolExecutor,
} from '@core/domain/agents';

/**
 * Base streaming executor that handles all tool types:
 * 1. Streaming context tools (sub-agents) - yield* their events
 * 2. Context tools (legacy non-streaming) - await and return
 * 3. Standard tools - await execute() and return
 *
 * This is the lowest level of the streaming harness, responsible for
 * dispatching to the correct execution path based on tool type.
 *
 * Checks abort signal before starting tool execution to ensure
 * cancellation is respected between LLM completion and tool execution.
 */
export function createStreamingBaseToolExecutor(): StreamingToolExecutor {
  return async function* (tool, toolCall, execCtx) {
    // Check if already cancelled before starting tool execution
    if (execCtx.ctx.signal.aborted) {
      return AgentToolResult.error('Operation cancelled', 'Cancelled', false);
    }

    try {
      // 1. Streaming context tool (e.g., streaming sub-agent)
      // These tools yield events during execution
      if (isAgentToolWithStreamingContext(tool)) {
        return yield* tool.executeStreamingWithContext(tool, toolCall, execCtx);
      }

      // 2. Context tool (legacy non-streaming)
      // These tools need full context but don't stream events
      if (isAgentToolWithContext(tool)) {
        return await tool.executeWithContext(tool, toolCall, execCtx);
      }

      // 3. Standard tool with ExecuteFunction signature
      if (!tool.execute) {
        return AgentToolResult.error(
          `Tool "${toolCall.toolName}" has no execute function`,
          'NoExecutor',
        );
      }

      // Call the tool's execute function with context
      const result = await tool.execute(execCtx.ctx, toolCall.input, {
        messages: execCtx.messages,
      });
      return AgentToolResult.success(result);
    } catch (e) {
      // Catch any tools that throw instead of returning AgentToolResult.error
      return AgentToolResult.error(
        e instanceof Error ? e.message : String(e),
        'ExecutionError',
        false,
      );
    }
  };
}
