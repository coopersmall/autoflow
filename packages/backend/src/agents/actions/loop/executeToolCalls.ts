import type { SuspendedBranch } from '@backend/agents/domain/execution';
import type { ToolExecutionHarness } from '@backend/agents/infrastructure/harness';
import type { Context } from '@backend/infrastructure/context/Context';
import type {
  AgentId,
  AgentRunId,
  CompletedAgentToolResult,
  Suspension,
  SuspensionStack,
} from '@core/domain/agents';
import type {
  Message,
  RequestToolResultPart,
  ToolCall,
  ToolWithExecution,
} from '@core/domain/ai';
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
  /** ID of the agent executing these tools (for event attribution) */
  readonly manifestId: AgentId;
  /** Version of the agent manifest executing these tools */
  readonly manifestVersion: string;
  /** ID of the parent agent if this is a sub-agent (for event attribution) */
  readonly parentManifestId?: AgentId;
  /** State ID of the current agent run */
  readonly stateId: AgentRunId;
}

/**
 * Result of executing tool calls.
 * Either all tools completed (success or error) or one or more tools suspended.
 */
export type ExecuteToolCallsResult =
  | {
      type: 'completed';
      toolResultParts: RequestToolResultPart[];
    }
  | {
      type: 'suspended';
      branches: SuspendedBranch[];
      completedToolResultParts: RequestToolResultPart[];
    };

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
  const {
    toolCalls,
    toolsMap,
    harness,
    ctx,
    messages,
    stepNumber,
    manifestId,
    manifestVersion,
    parentManifestId,
    stateId,
  } = params;

  const promises = toolCalls.map(async (toolCall) => {
    return executeToolCall({
      toolCall,
      toolsMap,
      harness,
      ctx,
      messages,
      stepNumber,
      manifestId,
      manifestVersion,
      parentManifestId,
      stateId,
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
  toolCallId: string;
  childStateId: AgentRunId;
  childManifestId: AgentId;
  childManifestVersion: string;
  suspensions: Suspension[];
  childStacks: SuspensionStack[];
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
  manifestId: AgentId;
  manifestVersion: string;
  parentManifestId?: AgentId;
  stateId: AgentRunId;
}): Promise<ToolCallResult> {
  const {
    toolCall,
    harness,
    ctx,
    messages,
    stepNumber,
    manifestId,
    manifestVersion,
    parentManifestId,
    stateId,
  } = params;

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
    manifestId,
    manifestVersion,
    parentManifestId,
    stateId,
  });

  if (toolResult.type === 'suspended') {
    return {
      type: 'suspended',
      toolCallId: toolCall.toolCallId,
      childStateId: toolResult.runId,
      childManifestId: toolResult.manifestId,
      childManifestVersion: toolResult.manifestVersion,
      suspensions: toolResult.suspensions,
      childStacks: toolResult.childStacks,
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
  const branches: SuspendedBranch[] = [];

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
        branches.push({
          toolCallId: result.toolCallId,
          childStateId: result.childStateId,
          childManifestId: result.childManifestId,
          childManifestVersion: result.childManifestVersion,
          suspensions: result.suspensions,
          childStacks: result.childStacks,
        });
        break;

      case 'completed':
        toolResultParts.push(
          convertAgentToolResultForLLM(result.toolCall, result.result),
        );
        break;
    }
  }

  if (branches.length > 0) {
    return {
      type: 'suspended',
      branches,
      completedToolResultParts: toolResultParts,
    };
  }

  return {
    type: 'completed',
    toolResultParts,
  };
}
