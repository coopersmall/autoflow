import type {
  AssistantMessage,
  Message,
  RequestAssistantContentPart,
  RequestToolCallPart,
  RequestToolResultPart,
  ToolMessage,
  UserMessage,
} from '../../ai/request';
import type { AgentItem } from '../items/AgentItem';
import {
  type ConversationItem,
  isAgentComplete,
  isUserMessage,
} from '../items/ConversationItem';
import type { MessageItem, UserMessageBody } from '../items/MessageItem';
import type { ToolCallResult } from '../shared/ToolCallResult';
import type { Step } from '../steps/Step';

/**
 * Converts a list of conversation items to a list of AI messages.
 *
 * This is used to build the message history for AI completion requests.
 * Items are processed in order, with each item potentially producing
 * multiple messages (e.g., an agent step with tool calls produces both
 * an AssistantMessage and a ToolMessage).
 *
 * Skipped items:
 * - AssistantMessage items (their content is captured in AgentItems)
 * - AgentItems with error or aborted status
 * - File attachments (not yet supported)
 *
 * @param items - The conversation items to convert
 * @returns Array of AI messages ready for completion requests
 */
export function toMessages(items: ConversationItem[]): Message[] {
  const messages: Message[] = [];

  for (const item of items) {
    if (isUserMessage(item)) {
      messages.push(userItemToMessage(item));
    } else if (isAgentComplete(item)) {
      messages.push(...agentItemToMessages(item));
    }
    // Skip: assistant message items, error/aborted agents
  }

  return messages;
}

/**
 * Converts a user MessageItem to a UserMessage
 */
function userItemToMessage(
  item: MessageItem & { message: UserMessageBody },
): UserMessage {
  return {
    role: 'user',
    content: item.message.text,
  };
}

/**
 * Converts a complete AgentItem to a list of messages.
 * Each step can produce an AssistantMessage and optionally a ToolMessage.
 */
function agentItemToMessages(
  item: AgentItem & { result: { status: 'complete' } },
): Message[] {
  const messages: Message[] = [];

  for (const step of item.result.steps) {
    messages.push(...stepToMessages(step));
  }

  return messages;
}

/**
 * Converts a single step to messages.
 * Returns an AssistantMessage, and if tools were called, also a ToolMessage.
 */
function stepToMessages(step: Step): Message[] {
  const messages: Message[] = [];
  const contentParts: RequestAssistantContentPart[] = [];

  // Add reasoning if present
  if (step.content.reasoning) {
    contentParts.push({
      type: 'reasoning',
      text: step.content.reasoning,
    });
  }

  // Add text if present
  if (step.content.text) {
    contentParts.push({
      type: 'text',
      text: step.content.text,
    });
  }

  // Add tool calls if present
  const tools = step.content.tools ?? [];
  for (const tool of tools) {
    contentParts.push(toolCallResultToToolCallPart(tool));
  }

  // Only add assistant message if there's content
  if (contentParts.length > 0) {
    const assistantMessage: AssistantMessage = {
      role: 'assistant',
      content: contentParts,
    };
    messages.push(assistantMessage);
  }

  // Add tool results as a separate ToolMessage
  const toolResults = tools.filter((t) => t.output !== undefined);
  if (toolResults.length > 0) {
    const toolMessage: ToolMessage = {
      role: 'tool',
      content: toolResults.map(toolCallResultToToolResultPart),
    };
    messages.push(toolMessage);
  }

  return messages;
}

/**
 * Converts a ToolCallResult to a RequestToolCallPart for the assistant message
 */
function toolCallResultToToolCallPart(
  tool: ToolCallResult,
): RequestToolCallPart {
  return {
    type: 'tool-call',
    toolCallId: tool.toolCallId,
    toolName: tool.toolName,
    input: stringifyInput(tool.input),
  };
}

/**
 * Converts a ToolCallResult to a RequestToolResultPart for the tool message
 */
function toolCallResultToToolResultPart(
  tool: ToolCallResult,
): RequestToolResultPart {
  return {
    type: 'tool-result',
    toolCallId: tool.toolCallId,
    toolName: tool.toolName,
    output: formatToolOutput(tool.output, tool.isError),
    isError: tool.isError,
  };
}

/**
 * Stringifies tool input for the request format.
 * The AI SDK expects input as a JSON string.
 */
function stringifyInput(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }
  return JSON.stringify(input);
}

/**
 * Formats tool output for the request format.
 * Converts unknown output to the structured output schema.
 */
function formatToolOutput(
  output: unknown,
  isError?: boolean,
): RequestToolResultPart['output'] {
  // Handle string output
  if (typeof output === 'string') {
    return {
      type: isError ? 'error-text' : 'text',
      value: output,
    };
  }

  // Handle other types as JSON
  const jsonString = JSON.stringify(output);
  return {
    type: isError ? 'error-json' : 'json',
    value: jsonString,
  };
}
