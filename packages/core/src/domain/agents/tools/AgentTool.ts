import type { ToolWithExecution } from '../../ai/request/completions/tools/Tool';
import type { AgentToolWithContext } from './AgentToolWithContext';

/**
 * Union of all tool types the agent framework can handle.
 *
 * - ToolWithExecution: Standard tools with execute(input, { messages })
 * - AgentToolWithContext: Context-aware tools with executeWithContext(tool, toolCall, execCtx)
 */
export type AgentTool = ToolWithExecution | AgentToolWithContext;

/**
 * Type guard to check if a tool needs full execution context.
 *
 * Context-aware tools have an executeWithContext property instead of (or in addition to) execute.
 * The harness uses this to determine which execution path to take.
 *
 * @param tool The tool to check
 * @returns true if the tool is an AgentToolWithContext
 */
export function isAgentToolWithContext(
  tool: AgentTool,
): tool is AgentToolWithContext {
  return (
    'executeWithContext' in tool &&
    typeof tool.executeWithContext === 'function'
  );
}
