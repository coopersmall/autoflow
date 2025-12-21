import {
  type AssistantMessage,
  type Message,
  type ToolMessage,
  unreachable,
} from '@autoflow/core';
import type { AssistantContent, ModelMessage, ToolContent } from 'ai';

export function convertMessages(messages: Message[]): ModelMessage[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'user':
        return {
          role: msg.role,
          content: msg.content,
        };
      case 'assistant':
        return {
          role: msg.role,
          content: convertAssistantMessageContent(msg.content),
        };
      case 'system':
        return {
          role: msg.role,
          content: msg.content,
        };
      case 'tool':
        return {
          role: 'tool',
          content: convertToolMessageContent(msg.content),
        };
      default:
        return unreachable(msg);
    }
  });
}

function convertAssistantMessageContent(
  content: AssistantMessage['content'],
): AssistantContent {
  if (typeof content === 'string') {
    return content;
  }
  return content.map((part) => {
    switch (part.type) {
      case 'text':
      case 'file':
      case 'reasoning':
        return part;
      case 'tool-call':
        return {
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: JSON.parse(part.input),
        };
      default:
        return unreachable(part);
    }
  });
}

function convertToolMessageContent(
  content: ToolMessage['content'],
): ToolContent {
  return content.map((part) => {
    switch (part.type) {
      case 'tool-result':
        switch (part.output.type) {
          case 'json':
          case 'error-json':
            return {
              ...part,
              output: {
                type: 'json',
                value: JSON.parse(part.output.value),
              },
            };
          case 'text':
          case 'error-text':
          case 'content':
            return part;
          default:
            return unreachable(part.output);
        }
      default:
        return unreachable(part.type);
    }
  });
}
