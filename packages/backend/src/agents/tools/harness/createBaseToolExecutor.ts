import type { ToolExecutor } from '@core/domain/agents';
import { AgentToolResult } from '@core/domain/agents';

/**
 * Base executor that calls the tool's execute function.
 * Catches any thrown errors and converts to AgentToolResult.error.
 */
export function createBaseToolExecutor(): ToolExecutor {
  return async (tool, toolCall, execCtx): Promise<AgentToolResult> => {
    if (!tool.execute) {
      return AgentToolResult.error(
        `Tool "${toolCall.toolName}" has no execute function`,
        'NoExecutor',
      );
    }

    try {
      // Tools return AgentToolResult directly
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
