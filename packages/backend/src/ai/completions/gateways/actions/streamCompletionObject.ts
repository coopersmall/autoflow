import {
  type AppError,
  badRequest,
  type ObjectStreamPart,
  type StructuredCompletionsRequest,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context';
import type { LanguageModelV2 } from '@openrouter/ai-sdk-provider';
import { jsonSchema, streamObject } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { CompletionsProvider } from '../../providers/CompletionsProviders';
import { convertMessages } from './utils/convertMessages';
import { convertProviderOptions } from './utils/convertProviderOptions';

export async function* streamCompletionObject(
  ctx: Context,
  provider: CompletionsProvider,
  model: LanguageModelV2,
  request: StructuredCompletionsRequest,
  actions = {
    streamObject,
  },
): AsyncGenerator<Result<ObjectStreamPart, AppError>> {
  try {
    const response = actions.streamObject({
      model,
      messages: convertMessages(request.messages),
      schema: jsonSchema(request.responseFormat.schema),
      schemaName: request.responseFormat.name,
      schemaDescription: request.responseFormat.description,
      providerOptions: convertProviderOptions(provider),
      mode: 'json',
      output: 'object',
      maxRetries: 0,
      abortSignal: ctx.signal,
    });

    for await (const part of response.fullStream) {
      yield ok(part);
    }
  } catch (error) {
    yield err(
      badRequest('Failed to generate streaming structured completion', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  }
}
