import type {
  AssistantMessage,
  Message,
  RequestAssistantContentPart,
  RequestToolResultPart,
  ToolCallPart,
} from '@core/domain/ai';

/**
 * Parameters for building iteration messages from streaming state.
 */
export interface BuildStreamIterationMessagesParams {
  readonly text: string;
  readonly toolCalls: readonly ToolCallPart[];
  readonly toolResultParts: readonly RequestToolResultPart[];
}

/**
 * Builds messages to append after a streaming step completes.
 *
 * Similar to buildIterationMessages but works with streaming accumulated state
 * instead of a full TextResponse.
 *
 * @param params - The accumulated state from streaming
 * @returns Array of messages to append (assistant message, then optional tool message)
 */
export function buildStreamIterationMessages(
  params: BuildStreamIterationMessagesParams,
): Message[] {
  const { text, toolCalls, toolResultParts } = params;
  const messages: Message[] = [];

  // Build assistant message with text and tool calls
  const assistantParts: RequestAssistantContentPart[] = [];

  // Add text if present
  if (text) {
    assistantParts.push({ type: 'text', text });
  }

  // Add tool calls (preserves what the LLM requested)
  for (const toolCall of toolCalls) {
    assistantParts.push({
      type: 'tool-call',
      toolCallId: toolCall.toolCallId,
      toolName: toolCall.toolName,
      input: JSON.stringify(toolCall.input),
    });
  }

  // Create assistant message if we have any content
  if (assistantParts.length > 0) {
    const assistantMessage: AssistantMessage = {
      role: 'assistant',
      // Use simple string if only text, array otherwise
      content:
        assistantParts.length === 1 && assistantParts[0].type === 'text'
          ? text
          : assistantParts,
    };
    messages.push(assistantMessage);
  }

  // Add tool results in a separate tool message (what we executed)
  if (toolResultParts.length > 0) {
    messages.push({
      role: 'tool',
      content: [...toolResultParts],
    });
  }

  return messages;
}
