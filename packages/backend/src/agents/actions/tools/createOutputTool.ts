import { AgentToolResult, type OutputToolConfig } from '@core/domain/agents';
import type { ToolWithExecution } from '@core/domain/ai';

/**
 * Creates the output tool from OutputToolConfig.
 * The output tool captures structured output from the agent.
 *
 * The execute function returns the raw output value wrapped in AgentToolResult.success().
 * Validation is handled separately in the agent loop with retry logic.
 */
export function createOutputTool(config: OutputToolConfig): ToolWithExecution {
  return {
    ...config.tool,
    execute: async (input: unknown) => {
      // Return the input as-is wrapped in success
      // Validation will be handled by the agent loop
      return AgentToolResult.success(input);
    },
  };
}
