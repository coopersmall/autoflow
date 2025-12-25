import { type RequestAssistantContentPart, unreachable } from '@autoflow/core';
import type { ContentPart, ToolSet } from 'ai';

/**
 * Converts SDK ContentPart array to our domain RequestAssistantContentPart array.
 *
 * The SDK's ContentPart includes various content types from generateText results.
 * This function maps them to our serialization-friendly domain types.
 */
export function convertFromContentParts(
  content: ContentPart<ToolSet>[],
): RequestAssistantContentPart[] {
  const parts: RequestAssistantContentPart[] = [];

  for (const part of content) {
    switch (part.type) {
      case 'text':
        parts.push({
          type: 'text',
          text: part.text,
        });
        break;

      case 'reasoning':
        parts.push({
          type: 'reasoning',
          text: part.text,
        });
        break;

      case 'file':
        parts.push({
          type: 'file',
          mediaType: part.file.mediaType,
          data: part.file.base64,
        });
        break;

      case 'source':
        if (part.sourceType === 'url') {
          parts.push({
            type: 'source',
            sourceType: 'url',
            id: part.id,
            url: part.url,
            title: part.title,
          });
        } else if (part.sourceType === 'document') {
          parts.push({
            type: 'source',
            sourceType: 'document',
            id: part.id,
            mediaType: part.mediaType,
            title: part.title,
            filename: part.filename,
          });
        } else {
          unreachable(part);
        }
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

      case 'tool-error':
        parts.push({
          type: 'tool-error',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
          error: part.error,
        });
        break;

      case 'tool-approval-request':
        parts.push({
          type: 'tool-approval-request',
          approvalId: part.approvalId,
          toolCall: {
            toolCallId: part.toolCall.toolCallId,
            toolName: part.toolCall.toolName,
            input: part.toolCall.input,
          },
        });
        break;

      default:
        unreachable(part);
    }
  }

  return parts;
}

/**
 * Converts SDK tool result output to our domain format.
 * Our format wraps the value with a type discriminator for serialization.
 */
function convertToolResultOutput(output: unknown): {
  type: 'text' | 'json';
  value: string;
} {
  if (typeof output === 'string') {
    return { type: 'text', value: output };
  }
  return { type: 'json', value: JSON.stringify(output) };
}
