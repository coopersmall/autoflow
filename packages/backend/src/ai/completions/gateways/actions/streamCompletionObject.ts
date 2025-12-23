import {
  type AppError,
  badRequest,
  type ObjectStreamPart,
  type StructuredCompletionsRequest,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context';
import { jsonSchema, type LanguageModel, Output, streamText } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { CompletionsProvider } from '../../providers/CompletionsProviders';
import { convertToModelMessages } from './utils/convertMessages';
import { convertProviderOptions } from './utils/convertProviderOptions';

export async function* streamCompletionObject(
  ctx: Context,
  provider: CompletionsProvider,
  model: LanguageModel,
  request: StructuredCompletionsRequest,
  actions = {
    streamText,
  },
): AsyncGenerator<Result<ObjectStreamPart, AppError>> {
  try {
    const response = actions.streamText({
      model,
      messages: convertToModelMessages(request.messages),
      output: Output.object({
        schema: jsonSchema(request.responseFormat.schema),
        name: request.responseFormat.name,
        description: request.responseFormat.description,
      }),
      providerOptions: convertProviderOptions(provider),
      maxRetries: 0,
      abortSignal: ctx.signal,
    });

    for await (const partialObject of response.partialOutputStream) {
      yield ok({
        type: 'object',
        object: partialObject,
      });
    }

    const [finishReason, usage, sdkResponse, providerMetadata] =
      await Promise.all([
        response.finishReason,
        response.usage,
        response.response,
        response.providerMetadata,
      ]);

    yield ok({
      type: 'finish',
      finishReason,
      usage,
      response: {
        id: sdkResponse.id,
        modelId: sdkResponse.modelId,
        timestamp: sdkResponse.timestamp,
        headers: sdkResponse.headers,
      },
      providerMetadata,
    });
  } catch (error) {
    yield err(
      badRequest('Failed to generate streaming structured completion', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  }
}
