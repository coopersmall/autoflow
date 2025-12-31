import type { ToolExecutionHarness } from '@backend/agents/infrastructure/harness';
import type { Context } from '@backend/infrastructure/context/Context';
import type { AgentId, AgentRunId } from '@core/domain/agents';
import type { Message, ToolCall, ToolWithExecution } from '@core/domain/ai';
import {
  buildToolCallResults,
  type ExecuteToolCallsResult,
  type ToolCallResult,
} from './toolCallResult';

// Re-export ExecuteToolCallsResult for backwards compatibility
export type { ExecuteToolCallsResult } from './toolCallResult';

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
  return buildToolCallResults(results);
}

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
