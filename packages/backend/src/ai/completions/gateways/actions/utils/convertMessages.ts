import {
  type AssistantMessage,
  type Message,
  type RequestToolResultPart,
  type ToolMessage,
  type UserMessage,
  unreachable,
} from '@autoflow/core';
import type {
  AssistantContent,
  DataContent,
  ModelMessage,
  ToolContent,
  ToolResultPart,
  UserContent,
} from 'ai';

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
      case 'tool-result':
        switch (part.output.type) {
          case 'text':
            return {
              ...part,
              output: {
                type: 'text',
                value: part.output.value,
              },
            };
          case 'json':
            return {
              ...part,
              output: {
                type: 'json',
                value: JSON.parse(part.output.value),
              },
            };
          case 'error-text':
            return {
              ...part,
              output: {
                type: 'error-text',
                value: part.output.value,
              },
            };
          case 'error-json':
            return {
              ...part,
              output: {
                type: 'error-json',
                value: JSON.parse(part.output.value),
              },
            };
          case 'content':
            return part;
          default:
            return unreachable(part.output);
        }
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

export function convertFromModelMessages(messages: ModelMessage[]): Message[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'user':
        return {
          role: msg.role,
          content: convertFromUserMessageContent(msg.content),
        };
      case 'assistant':
        return {
          role: msg.role,
          content: convertFromAssistantMessageContent(msg.content),
        };
      case 'system':
        return {
          role: msg.role,
          content: msg.content,
        };
      case 'tool':
        return {
          role: 'tool',
          content: convertFromToolMessageContent(msg.content),
        };
      default:
        return unreachable(msg);
    }
  });
}

function convertFromUserMessageContent(
  content: UserContent,
): UserMessage['content'] {
  if (typeof content === 'string') {
    return content;
  }
  return content.map((part) => {
    switch (part.type) {
      case 'text':
        return { type: 'text', text: part.text };
      case 'image':
        return {
          type: 'image',
          image: convertDataContentToString(part.image),
          mediaType: part.mediaType,
        };
      case 'file':
        return {
          type: 'file',
          data: convertDataContentToString(part.data),
          mediaType: part.mediaType,
          filename: part.filename,
        };
      default:
        return unreachable(part);
    }
  });
}

function convertFromAssistantMessageContent(
  content: AssistantContent,
): AssistantMessage['content'] {
  if (typeof content === 'string') {
    return content;
  }

  const parts: AssistantMessage['content'] = [];

  for (const part of content) {
    switch (part.type) {
      case 'text':
        parts.push({ type: 'text', text: part.text });
        break;
      case 'reasoning':
        parts.push({ type: 'reasoning', text: part.text });
        break;
      case 'file':
        parts.push({
          type: 'file',
          data: convertDataContentToString(part.data),
          mediaType: part.mediaType,
          filename: part.filename,
        });
        break;
      case 'tool-call':
        parts.push({
          type: 'tool-call',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: JSON.stringify(part.input),
        });
        break;
      case 'tool-result':
        parts.push({
          type: 'tool-result',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: convertToolResultOutput(part.output),
        });
        break;
      case 'tool-approval-request':
        // Skip tool approval requests - not yet supported in domain types
        break;
      default:
        unreachable(part);
    }
  }

  return parts;
}
function convertDataContentToString(data: DataContent | URL): string {
  if (data instanceof URL) {
    return data.toString();
  }
  if (typeof data === 'string') {
    return data;
  }
  const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  return Buffer.from(uint8).toString('base64');
}
function convertFromToolMessageContent(
  content: ToolContent,
): ToolMessage['content'] {
  const parts: ToolMessage['content'] = [];

  for (const part of content) {
    switch (part.type) {
      case 'tool-result':
        parts.push({
          type: 'tool-result',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          output: convertToolResultOutput(part.output),
          isError:
            part.output.type === 'error-text' ||
            part.output.type === 'error-json'
              ? true
              : undefined,
        });
        break;
      case 'tool-approval-response':
        // Skip tool approval responses - not yet supported in domain types
        break;
      default:
        unreachable(part);
    }
  }

  return parts;
}
function convertToolResultOutput(
  output: ToolResultPart['output'],
): RequestToolResultPart['output'] {
  switch (output.type) {
    case 'text':
      return { type: 'text', value: output.value };
    case 'json':
      return { type: 'json', value: JSON.stringify(output.value) };
    case 'error-text':
      return { type: 'error-text', value: output.value };
    case 'error-json':
      return { type: 'error-json', value: JSON.stringify(output.value) };
    case 'content':
      // Filter out unsupported content types (file-data, execution-denied, etc.)
      // and only keep text and media
      return {
        type: 'content',
        value: output.value
          .filter(
            (
              item,
            ): item is
              | { type: 'text'; text: string }
              | { type: 'media'; data: string; mediaType: string } =>
              item.type === 'text' || item.type === 'media',
          )
          .map((item) => {
            if (item.type === 'text') {
              return { type: 'text' as const, text: item.text };
            }
            return {
              type: 'media' as const,
              data: item.data,
              mediaType: item.mediaType,
            };
          }),
      };
    case 'execution-denied':
      // Convert execution-denied to error-text for domain compatibility
      return {
        type: 'error-text',
        value: output.reason ?? 'Tool execution was denied',
      };
    default:
      unreachable(output);
  }
}
