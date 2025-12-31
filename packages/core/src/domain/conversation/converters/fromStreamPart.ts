import type { StreamPart } from '../../ai/response';
import type { FilePayload } from '../../file';
import type { ItemEventData } from '../events/EventData';

/**
 * Result of converting a StreamPart, including any file payloads for upload
 */
export interface StreamConversionResult {
  event: ItemEventData | undefined;
}

/**
 * Converts an AI SDK StreamPart to our ItemEventData type.
 * This decouples the conversation domain from the AI SDK's streaming format.
 *
 * For file events, this generates a FileAssetId and returns both:
 * - A file-generated event (metadata only)
 * - A FilePayload containing the raw binary data for the caller to upload
 *
 * @param streamPart - The streaming event from the AI SDK
 * @param filePayload - Optional file payload if this is a file event
 * @returns The converted event data and optional file payloads
 */
export function fromStreamPart(
  streamPart: StreamPart,
  filePayload?: FilePayload,
): StreamConversionResult {
  switch (streamPart.type) {
    // Text events - strip providerMetadata
    case 'text-start':
      return { event: { type: 'text-start', id: streamPart.id } };
    case 'text-end':
      return { event: { type: 'text-end', id: streamPart.id } };
    case 'text-delta':
      return {
        event: { type: 'text-delta', id: streamPart.id, text: streamPart.text },
      };

    // Reasoning events - strip providerMetadata
    case 'reasoning-start':
      return { event: { type: 'reasoning-start', id: streamPart.id } };
    case 'reasoning-end':
      return { event: { type: 'reasoning-end', id: streamPart.id } };
    case 'reasoning-delta':
      return {
        event: {
          type: 'reasoning-delta',
          id: streamPart.id,
          text: streamPart.text,
        },
      };

    // Source events - strip providerMetadata
    case 'source':
      if (streamPart.sourceType === 'url') {
        return {
          event: {
            type: 'source',
            id: streamPart.id,
            title: streamPart.title,
            content: {
              sourceType: 'url',
              url: streamPart.url,
            },
          },
        };
      }
      return {
        event: {
          type: 'source',
          id: streamPart.id,
          title: streamPart.title,
          content: {
            sourceType: 'document',
            mediaType: streamPart.mediaType,
            filename: streamPart.filename,
          },
        },
      };

    // File events - require filePayload from caller
    case 'file':
      if (filePayload) {
        return {
          event: {
            type: 'file-generated',
            id: filePayload.id,
            mediaType: filePayload.mediaType,
          },
        };
      }
      // No filePayload provided - caller must handle file extraction separately
      return { event: undefined };

    // Tool input streaming events - strip providerMetadata
    case 'tool-input-start':
      return {
        event: {
          type: 'tool-input-start',
          id: streamPart.id,
          toolName: streamPart.toolName,
        },
      };
    case 'tool-input-end':
      return { event: { type: 'tool-input-end', id: streamPart.id } };
    case 'tool-input-delta':
      return {
        event: {
          type: 'tool-input-delta',
          id: streamPart.id,
          delta: streamPart.delta,
        },
      };

    // Tool call/result events - explicitly map fields to strip provider details
    case 'tool-call':
      return {
        event: {
          type: 'tool-call',
          toolCallId: streamPart.toolCallId,
          toolName: streamPart.toolName,
          input: streamPart.input,
          invalid: streamPart.invalid,
        },
      };
    case 'tool-result':
      return {
        event: {
          type: 'tool-result',
          toolCallId: streamPart.toolCallId,
          toolName: streamPart.toolName,
          input: streamPart.input,
          output: streamPart.output,
        },
      };
    case 'tool-error':
      return {
        event: {
          type: 'tool-error',
          toolCallId: streamPart.toolCallId,
          toolName: streamPart.toolName,
          input: streamPart.input,
          error: streamPart.error,
        },
      };
    case 'tool-output-denied':
      // Tool output was denied - convert to tool error for domain compatibility
      return {
        event: {
          type: 'tool-error',
          toolCallId: streamPart.toolCallId,
          toolName: streamPart.toolName,
          error: 'Tool output was denied',
        },
      };

    case 'tool-approval-request':
      // Tool requires approval before execution
      return {
        event: {
          type: 'tool-approval-request',
          approvalId: streamPart.approvalId,
          toolCall: streamPart.toolCall,
        },
      };

    // Lifecycle events
    case 'start':
      return { event: { type: 'start' } };
    case 'finish':
      return {
        event: { type: 'finish', finishReason: streamPart.finishReason },
      };
    case 'error':
      return { event: { type: 'error', error: streamPart.error } };
    case 'abort':
      return { event: { type: 'abort' } };

    // Step lifecycle events
    // Note: stepIndex is not provided by the SDK; caller must track step count
    case 'start-step':
      return {
        event: {
          type: 'step-start',
          stepIndex: 0, // Caller should replace with actual step index
        },
      };
    case 'finish-step':
      return {
        event: {
          type: 'step-finish',
          stepIndex: 0, // Caller should replace with actual step index
          usage: streamPart.usage,
          finishReason: streamPart.finishReason,
          isContinued: streamPart.response.isContinued,
        },
      };

    // Ignored events (SDK-specific, not needed in our domain)
    case 'raw':
      return { event: undefined };

    default: {
      // Exhaustive check - if we reach here, we have an unhandled stream part type
      const _exhaustiveCheck: never = streamPart;
      return { event: undefined };
    }
  }
}
