import {
  type AssistantMessage,
  type Message,
  type ToolMessage,
  unreachable,
} from '@autoflow/core';
import type { AssistantContent, ModelMessage, ToolContent } from 'ai';

export function convertToModelMessages(messages: Message[]): ModelMessage[] {
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

  const parts: AssistantContent = [];

  for (const part of content) {
    switch (part.type) {
      case 'text':
      case 'file':
      case 'reasoning':
        parts.push(part);
        break;
      case 'tool-call':
        parts.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: JSON.parse(part.input),
        });
        break;
      case 'tool-approval-request':
        parts.push({
          type: 'tool-approval-request',
          approvalId: part.approvalId,
          toolCallId: part.toolCall.toolCallId,
        });
        break;
      case 'source':
        // Source parts are response-only, skip when sending to SDK
        break;
      case 'tool-error':
        // Tool error parts are response-only, skip when sending to SDK
        break;
      case 'tool-result':
        switch (part.output.type) {
          case 'text':
            parts.push({
              ...part,
              output: {
                type: 'text',
                value: part.output.value,
              },
            });
            break;
          case 'json':
            parts.push({
              ...part,
              output: {
                type: 'json',
                value: JSON.parse(part.output.value),
              },
            });
            break;
          case 'error-text':
            parts.push({
              ...part,
              output: {
                type: 'error-text',
                value: part.output.value,
              },
            });
            break;
          case 'error-json':
            parts.push({
              ...part,
              output: {
                type: 'error-json',
                value: JSON.parse(part.output.value),
              },
            });
            break;
          case 'content':
            parts.push(part);
            break;
          default:
            unreachable(part.output);
        }
        break;
      default:
        unreachable(part);
    }
  }

  return parts;
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
      case 'tool-approval-response':
        return {
          type: 'tool-approval-response',
          approvalId: part.approvalId,
          approved: part.approved,
          reason: part.reason,
        };
      default:
        return unreachable(part);
    }
  });
}
