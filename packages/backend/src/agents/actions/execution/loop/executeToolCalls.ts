import type { ToolExecutionHarness } from '@backend/agents/infrastructure/harness';
import type { Context } from '@backend/infrastructure/context/Context';
import type { CompletedAgentToolResult, Suspension } from '@core/domain/agents';
import type {
  Message,
  RequestToolResultPart,
  ToolCall,
  ToolWithExecution,
} from '@core/domain/ai';
import { convertAgentToolResultForLLM } from '../../tools/convertAgentToolResultForLLM';

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
  | { type: 'suspended'; suspensions: Suspension[] };

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

  const promises = toolCalls.map(async (toolCall) => {
    return executeToolCall({
      toolCall,
      toolsMap,
      harness,
      ctx,
      messages,
      stepNumber,
    });
  });

  const results = await Promise.all(promises);
  return buildExecutionResults(results);
}

type ToolCallResult =
  | CompletedToolCallResult
  | SuspendedToolCallResult
  | UnknownToolCallResult;

type CompletedToolCallResult = {
  type: 'completed';
  toolCall: ToolCall;
  result: CompletedAgentToolResult;
};

type SuspendedToolCallResult = {
  type: 'suspended';
  suspension: Suspension;
};

type UnknownToolCallResult = {
  type: 'unknown-tool';
  toolCall: ToolCall;
};

async function executeToolCall(params: {
  toolCall: ToolCall;
  toolsMap: Map<string, ToolWithExecution>;
  harness: ToolExecutionHarness;
  ctx: Context;
  messages: Message[];
  stepNumber: number;
}): Promise<ToolCallResult> {
  const { toolCall, harness, ctx, messages, stepNumber } = params;

  const tool = params.toolsMap.get(toolCall.toolName);
  if (!tool) {
    return {
      type: 'unknown-tool',
      toolCall,
    };
  }

  const toolResult = await harness.execute(tool, toolCall, {
    ctx,
    messages,
    stepNumber,
  });

  if (toolResult.type === 'suspended') {
    return {
      type: 'suspended',
      suspension: toolResult.suspension,
    };
  }

  return {
    type: 'completed',
    toolCall,
    result: toolResult,
  };
}

function buildExecutionResults(
  results: ToolCallResult[],
): ExecuteToolCallsResult {
  const toolResultParts: RequestToolResultPart[] = [];
  const suspensions: Suspension[] = [];

  for (const result of results) {
    switch (result.type) {
      case 'unknown-tool':
        toolResultParts.push({
          type: 'tool-result',
          toolCallId: result.toolCall.toolCallId,
          toolName: result.toolCall.toolName,
          output: {
            type: 'error-text',
            value: `Unknown tool: ${result.toolCall.toolName}`,
          },
          isError: true,
        });
        break;
      case 'suspended':
        suspensions.push(result.suspension);
        break;
      default:
        toolResultParts.push(
          convertAgentToolResultForLLM(result.toolCall, result.result),
        );
        break;
    }
  }

  if (suspensions.length > 0) {
    return {
      type: 'suspended',
      suspensions,
    };
  }

  return {
    type: 'completed',
    toolResultParts,
  };
}
