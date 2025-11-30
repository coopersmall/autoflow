import type { StreamPart } from '@core/domain/ai/streamingPart';
import type { AsyncIterableStream, TextStreamPart, ToolSet } from 'ai';

export async function* parseDataStream<TOOLS extends ToolSet>({
  stream,
}: {
  stream: AsyncIterableStream<TextStreamPart<TOOLS>>;
}): AsyncGenerator<StreamPart, void, unknown> {
  try {
    for await (const part of stream) {
      const convertedPart = convertTextStreamPartToStreamPart(part);
      if (convertedPart) {
        yield convertedPart;
      }
    }
  } catch (error) {
    yield {
      type: 'error',
      message:
        error instanceof Error ? error.message : 'Unknown streaming error',
    };
  }
}

function convertTextStreamPartToStreamPart<TOOLS extends ToolSet>(
  part: TextStreamPart<TOOLS>,
): StreamPart | null {
  switch (part.type) {
    case 'error':
      return {
        type: 'error',
        message: JSON.stringify(part.error),
      };

    case 'text-start':
      return { type: 'text', content: '' };

    case 'text-delta':
      return { type: 'text', content: part.text };

    case 'text-end':
      return { type: 'text', content: '' };

    case 'reasoning-start':
      return { type: 'reasoning', content: '' };

    case 'reasoning-delta':
      return { type: 'reasoning', content: part.text };

    case 'reasoning-end':
      return { type: 'reasoning', content: '' };

    case 'tool-input-start':
      return {
        type: 'tool-call-streaming-start',
        toolCallId: part.id,
        toolName: part.toolName,
      };

    case 'tool-input-delta':
      return {
        type: 'tool-call-delta',
        toolCallId: part.id,
        argsTextDelta: part.delta,
      };

    case 'tool-input-end':
      return {
        type: 'tool-call-delta',
        toolCallId: part.id,
        argsTextDelta: '',
      };

    case 'tool-call':
      return {
        type: 'tool-call',
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.input,
      };

    case 'tool-result':
      return {
        type: 'tool-result',
        toolCallId: part.toolCallId,
        result: part.output,
      };

    case 'tool-error':
      return {
        type: 'error',
        message: JSON.stringify(part.error),
      };

    case 'file':
      return {
        type: 'file',
        data: part.file.base64,
        mimeType: part.file.mediaType,
      };

    case 'finish':
      return {
        type: 'finish-message',
        finishReason: part.finishReason,
        usage: part.totalUsage,
      };

    case 'source':
    case 'abort':
    case 'start':
    case 'start-step':
    case 'finish-step':
    case 'raw':
      return null;

    default:
      return null;
  }
}
