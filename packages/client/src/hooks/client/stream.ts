import type { AppError, StreamChunk } from '@autoflow/core';
import type { HttpClient } from '@client/http-client/httpClient';
import { err, ok, type Result } from 'neverthrow';
import {
  type ParseStreamChunksOptions,
  parseStreamChunks,
} from './parseStreamChunks';

export interface StreamingOptions extends ParseStreamChunksOptions {
  retryAttempts?: number;
  onRetry?: (attempt: number, error: Error) => void;
  streamTimeoutMs?: number;
}

export interface StreamingCompletionActions {
  parseStreamChunks: typeof parseStreamChunks;
}

export async function stream<REQUEST>(
  client: HttpClient,
  uri: string,
  body: REQUEST,
  options: StreamingOptions = {},
  actions: StreamingCompletionActions = {
    parseStreamChunks,
  },
): Promise<Result<AsyncIterable<StreamChunk>, AppError>> {
  const {
    retryAttempts = 3,
    onRetry,
    onProgress,
    onComplete,
    onError,
    streamTimeoutMs = 300000,
  } = options;

  const result = await client.postStream(
    {
      uri,
      body,
    },
    {
      retryAttempts,
      onRetry,
      streamTimeoutMs,
      retryDelayMs: 1000,
    },
  );

  if (result.isErr()) {
    return err(result.error);
  }

  const { stream, cancel } = result.value;
  const chunks = actions.parseStreamChunks(stream, cancel, {
    onProgress,
    onComplete,
    onError,
  });
  return ok(chunks);
}
