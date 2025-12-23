import {
  type AppError,
  badRequest,
  type ObjectResponse,
  type StructuredCompletionsRequest,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context';
import { generateText, jsonSchema, type LanguageModel, Output } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { CompletionsProvider } from '../../providers/CompletionsProviders';
import { convertToModelMessages } from './utils/convertMessages';
import { convertProviderOptions } from './utils/convertProviderOptions';

export async function completionObject(
  ctx: Context,
  provider: CompletionsProvider,
  model: LanguageModel,
  request: StructuredCompletionsRequest,
  actions = {
    generateText,
  },
): Promise<Result<ObjectResponse, AppError>> {
  try {
    const response = await actions.generateText({
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

    // Convert generateText result to ObjectResponse format
    const objectResponse: ObjectResponse = {
      object: response.output,
      finishReason: response.finishReason,
      usage: response.usage,
      request: response.request,
      response: {
        id: response.response.id,
        modelId: response.response.modelId,
        timestamp: response.response.timestamp,
        headers: response.response.headers,
      },
      warnings: response.warnings,
      providerMetadata: response.providerMetadata,
    };

    return ok(objectResponse);
  } catch (error) {
    return err(
      badRequest('Failed to generate structured completion', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  }
}
