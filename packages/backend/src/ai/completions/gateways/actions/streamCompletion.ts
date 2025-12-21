import {
  type AppError,
  badRequest,
  type StandardCompletionsRequest,
  type StreamPart,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context.ts';
import type { LanguageModelV2 } from '@openrouter/ai-sdk-provider';
import { streamText } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { CompletionsProvider } from '../../providers/CompletionsProviders.ts';
import { convertCompletionRequest } from './utils/convertCompletionRequest.ts';

export async function* streamCompletion(
  ctx: Context,
  provider: CompletionsProvider,
  model: LanguageModelV2,
  request: StandardCompletionsRequest,
  actions = {
    streamText,
  },
): AsyncGenerator<Result<StreamPart, AppError>> {
  try {
    const response = actions.streamText({
      ...convertCompletionRequest(provider, request),
      model,
      maxRetries: 0,
      abortSignal: ctx.signal,
    });
    for await (const part of response.fullStream) {
      yield ok(part);
    }
  } catch (error) {
    yield err(
      badRequest('Failed to generate streaming completion', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  }
}
