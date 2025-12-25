import type { Context } from '@backend/infrastructure/context/Context';
import type { Suspension } from '@core/domain/agents';
import type {
  Message,
  RequestToolResultPart,
  ToolCall,
  ToolWithExecution,
} from '@core/domain/ai';
import type { ToolExecutionHarness } from '../../tools/harness/createToolExecutionHarness';
import { convertAgentToolResultForLLM } from '../tools/convertAgentToolResultForLLM';

/**
 * Parameters for executing tool calls.
 */
export interface ExecuteToolCallsParams {
  /** Tool calls from the LLM response */
  readonly toolCalls: ToolCall[];
  /** Map of tool name to tool definition for lookup */
  readonly toolsMap: Map<string, ToolWithExecution>;
  /** Tool execution harness (with middleware) */
  readonly harness: ToolExecutionHarness;
  /** Request context for cancellation */
  readonly ctx: Context;
  /** Current conversation messages */
  readonly messages: Message[];
  /** Current step number in the agent loop */
  readonly stepNumber: number;
}

/**
 * Result of executing tool calls.
 * Either all tools completed (success or error) or one tool suspended.
 */
export type ExecuteToolCallsResult =
  | { type: 'completed'; toolResultParts: RequestToolResultPart[] }
  | { type: 'suspended'; suspension: Suspension };

/**
 * Executes tool calls via the harness and converts results to LLM format.
 *
 * This function:
 * 1. Looks up each tool by name in the tools map
 * 2. Executes each tool via the harness with middleware
 * 3. Handles unknown tools as errors
 * 4. Returns early if any tool suspends
 * 5. Converts completed results to RequestToolResultPart format
 *
 * @returns Either 'completed' with all tool results, or 'suspended' with the suspension
 */
export async function executeToolCalls(
  params: ExecuteToolCallsParams,
): Promise<ExecuteToolCallsResult> {
  const { toolCalls, toolsMap, harness, ctx, messages, stepNumber } = params;

  const toolResultParts: RequestToolResultPart[] = [];

  for (const toolCall of toolCalls) {
    const tool = toolsMap.get(toolCall.toolName);

    // Handle unknown tool - add error result and continue
    if (!tool) {
      toolResultParts.push({
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        output: {
          type: 'error-text',
          value: `Unknown tool: ${toolCall.toolName}`,
        },
        isError: true,
      });
      continue;
    }

    // Execute tool via harness (applies middleware)
    const toolResult = await harness.execute(tool, toolCall, {
      ctx,
      messages,
      stepNumber,
    });

    // Handle suspension - early return
    if (toolResult.type === 'suspended') {
      return {
        type: 'suspended',
        suspension: toolResult.suspension,
      };
    }

    // TypeScript now knows: toolResult is CompletedAgentToolResult (success | error)
    toolResultParts.push(convertAgentToolResultForLLM(toolCall, toolResult));
  }

  return {
    type: 'completed',
    toolResultParts,
  };
}
