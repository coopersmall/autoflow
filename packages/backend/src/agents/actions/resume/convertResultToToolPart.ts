import type { AgentId, AgentRunResultNonSuspended } from '@core/domain/agents';
import type { RequestToolResultPart } from '@core/domain/ai';

/**
 * Converts an AgentRunResult to a RequestToolResultPart.
 */
export function convertResultToToolPart(
  toolCallId: string,
  manifestId: AgentId,
  result: AgentRunResultNonSuspended,
): RequestToolResultPart {
  if (result.status === 'error') {
    return {
      type: 'tool-result',
      toolCallId,
      toolName: `sub_agent_${manifestId}`,
      output: {
        type: 'error-json',
        value: JSON.stringify({
          error: result.error.message,
          code: result.error.code,
        }),
      },
      isError: true,
    };
  }

  return {
    type: 'tool-result',
    toolCallId,
    toolName: `sub_agent_${manifestId}`,
    output: {
      type: 'json',
      value: JSON.stringify({
        text: result.result.text,
        output: result.result.output,
      }),
    },
    isError: false,
  };
}
