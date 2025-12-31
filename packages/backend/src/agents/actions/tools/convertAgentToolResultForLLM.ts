import type { CompletedAgentToolResult } from '@core/domain/agents';
import type { RequestToolResultPart, ToolCall } from '@core/domain/ai';

// Type alias for the output field of RequestToolResultPart
type ToolResultOutput = RequestToolResultPart['output'];

/**
 * Converts a completed AgentToolResult to RequestToolResultPart for the LLM.
 *
 * Note: Only accepts CompletedAgentToolResult (success | error).
 * Caller must handle 'suspended' separately before calling this function.
 * TypeScript's control flow analysis ensures this via type narrowing.
 */
export function convertAgentToolResultForLLM(
  toolCall: ToolCall,
  agentResult: CompletedAgentToolResult,
): RequestToolResultPart {
  switch (agentResult.type) {
    case 'success':
      return {
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        output: serializeOutput(agentResult.value),
        isError: false,
      };

    case 'error':
      return {
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        output: {
          type: 'error-json',
          value: JSON.stringify({
            error: agentResult.error,
            code: agentResult.code,
          }),
        },
        isError: true,
      };
  }
}

function serializeOutput(value: unknown): ToolResultOutput {
  if (typeof value === 'string') {
    return { type: 'text', value };
  }
  return { type: 'json', value: JSON.stringify(value) };
}
