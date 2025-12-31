import type {
  AssistantMessage,
  Message,
  RequestAssistantContentPart,
  RequestToolResultPart,
  TextResponse,
} from '@core/domain/ai';

/**
 * Builds the messages to append after each agent loop iteration.
 *
 * The assistant message includes:
 * - Text content from the LLM response
 * - Reasoning output (if present)
 * - Tool calls the LLM made
 *
 * The tool message includes:
 * - Tool execution results
 *
 * This preserves the full conversation context including what the LLM
 * requested (tool calls) and what we executed (tool results).
 *
 * @param response - The LLM response from the current step
 * @param toolResultParts - The tool execution results from our harness
 * @returns Array of messages to append (assistant message, then optional tool message)
 */
export function buildIterationMessages(
  response: TextResponse,
  toolResultParts: RequestToolResultPart[],
): Message[] {
  const messages: Message[] = [];

  // Build assistant message with text, reasoning, and tool calls
  const assistantParts: RequestAssistantContentPart[] = [];

  // Add text if present
  if (response.text) {
    assistantParts.push({ type: 'text', text: response.text });
  }

  // Add reasoning if present (drop providerMetadata as it's not part of request schema)
  for (const reasoning of response.reasoning ?? []) {
    assistantParts.push({
      type: 'reasoning',
      text: reasoning.text,
    });
  }

  // Add tool calls from the response (preserves what the LLM requested)
  for (const toolCall of response.toolCalls ?? []) {
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
          ? response.text
          : assistantParts,
    };
    messages.push(assistantMessage);
  }

  // Add tool results in a separate tool message (what we executed)
  if (toolResultParts.length > 0) {
    messages.push({
      role: 'tool',
      content: toolResultParts,
    });
  }

  return messages;
}
