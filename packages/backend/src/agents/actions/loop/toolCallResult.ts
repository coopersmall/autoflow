import type { SuspendedBranch } from '@backend/agents/domain/execution';
import type {
  AgentId,
  AgentRunId,
  CompletedAgentToolResult,
  Suspension,
  SuspensionStack,
} from '@core/domain/agents';
import type { RequestToolResultPart, ToolCall } from '@core/domain/ai';
import { convertAgentToolResultForLLM } from '../tools/convertAgentToolResultForLLM';

/**
 * Result of a single tool call execution.
 * Used by both streaming and non-streaming tool execution paths.
 */
export type ToolCallResult =
  | CompletedToolCallResult
  | SuspendedToolCallResult
  | UnknownToolCallResult;

/**
 * A tool call that completed successfully or with an error.
 */
export type CompletedToolCallResult = {
  readonly type: 'completed';
  readonly toolCall: ToolCall;
  readonly result: CompletedAgentToolResult;
};

/**
 * A tool call that resulted in a sub-agent suspension.
 */
export type SuspendedToolCallResult = {
  readonly type: 'suspended';
  readonly toolCallId: string;
  readonly childStateId: AgentRunId;
  readonly childManifestId: AgentId;
  readonly childManifestVersion: string;
  readonly suspensions: Suspension[];
  readonly childStacks: SuspensionStack[];
};

/**
 * A tool call for an unknown/unregistered tool.
 */
export type UnknownToolCallResult = {
  readonly type: 'unknown-tool';
  readonly toolCall: ToolCall;
};

/**
 * Result of executing tool calls.
 * Either all tools completed (success or error) or one or more tools suspended.
 */
export type ExecuteToolCallsResult =
  | {
      readonly type: 'completed';
      readonly toolResultParts: RequestToolResultPart[];
    }
  | {
      readonly type: 'suspended';
      readonly branches: SuspendedBranch[];
      readonly completedToolResultParts: RequestToolResultPart[];
    };

/**
 * Builds the final ExecuteToolCallsResult from individual tool call results.
 * Shared by both streaming and non-streaming tool execution.
 *
 * @param results - Array of individual tool call results
 * @returns Either 'completed' with all tool results, or 'suspended' with branches
 */
export function buildToolCallResults(
  results: readonly ToolCallResult[],
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
          suspensions: [...result.suspensions],
          childStacks: [...result.childStacks],
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
