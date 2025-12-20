import {
  type AppError,
  badRequest,
  type StandardCompletionsRequest,
  type TextResponse,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context.ts';
import type { LanguageModelV2 } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { CompletionsProvider } from '../../providers/CompletionsProviders.ts';
import { convertCompletionRequest } from './utils/convertCompletionRequest.ts';

export interface CompletionRequest {
  provider: CompletionsProvider;
  request: StandardCompletionsRequest;
}

export async function completion(
  ctx: Context,
  provider: CompletionsProvider,
  model: LanguageModelV2,
  request: StandardCompletionsRequest,
  actions = {
    generateText,
  },
): Promise<Result<TextResponse, AppError>> {
  try {
    const response = await actions.generateText({
      ...convertCompletionRequest(provider, request),
      model,
      maxRetries: 0,
      abortSignal: ctx.signal,
    });
    return ok(response);
  } catch (error) {
    return err(
      badRequest('Failed to generate completion', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  }
}
