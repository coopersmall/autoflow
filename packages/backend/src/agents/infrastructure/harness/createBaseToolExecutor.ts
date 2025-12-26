import {
  AgentToolResult,
  isAgentToolWithContext,
  type ToolExecutor,
} from '@core/domain/agents';

/**
 * Base executor that calls the tool's execute function.
 * Handles both standard tools and context-aware tools (like sub-agents).
 * Catches any thrown errors and converts to AgentToolResult.error.
 */
export function createBaseToolExecutor(): ToolExecutor {
  return async (tool, toolCall, execCtx): Promise<AgentToolResult> => {
    try {
      // Check if this is a context-aware tool (e.g., sub-agent)
      if (isAgentToolWithContext(tool)) {
        return await tool.executeWithContext(tool, toolCall, execCtx);
      }

      // Standard tool with ExecuteFunction signature
      if (!tool.execute) {
        return AgentToolResult.error(
          `Tool "${toolCall.toolName}" has no execute function`,
          'NoExecutor',
        );
      }

      // Call the tool's execute function
      const result = await tool.execute(toolCall.input, {
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
