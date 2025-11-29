import type { StreamChunk, StreamChunkError } from '@autoflow/core';
import { validStreamChunk } from '@autoflow/core';

export interface ParseStreamChunksOptions {
  onProgress?: (chunk: StreamChunk) => void;
  onComplete?: (finalContent: StreamChunk) => void;
  onError?: (error: string) => void;
}

export async function* parseStreamChunks(
  stream: ReadableStream<Uint8Array>,
  cancel: () => void,
  options: ParseStreamChunksOptions = {},
): AsyncIterable<StreamChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let chunkIndex = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const chunkResult = validStreamChunk(JSON.parse(line));
            if (chunkResult.isErr()) {
              yield createParseErrorChunk(chunkIndex++);
              continue;
            }

            const chunk = chunkResult.value;

            switch (chunk.type) {
              case 'chunk':
                if (options.onProgress) {
                  options.onProgress(chunk);
                }
                yield chunk;
                break;

              case 'complete':
                if (options.onComplete) {
                  options.onComplete(chunk);
                }
                yield chunk;
                break;

              case 'error':
                if (options.onError) {
                  options.onError(chunk.message);
                }
                yield chunk;
                break;
            }
          } catch {
            yield createParseErrorChunk(chunkIndex++);
          }
        }
      }
    }
  } catch {
    yield createParseErrorChunk(chunkIndex++);
  } finally {
    reader.releaseLock();
    cancel();
  }
}

function createParseErrorChunk(chunkIndex: number): StreamChunkError {
  return {
    type: 'error',
    message: 'Failed to parse stream chunk',
    metadata: {
      timestamp: new Date().toISOString(),
      chunkIndex: chunkIndex,
    },
  };
}
