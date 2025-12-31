import type { RequestToolResultPart, ToolMessage } from '@core/domain/ai';

/**
 * Builds a tool message containing the provided tool results.
 * Used when resuming from parallel sub-agent suspensions.
 */
export function buildToolResultMessage(
  toolResults: RequestToolResultPart[],
): ToolMessage {
  return {
    role: 'tool',
    content: toolResults,
  };
}
