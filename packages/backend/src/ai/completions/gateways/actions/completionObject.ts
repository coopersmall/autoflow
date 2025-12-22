import {
  type AppError,
  badRequest,
  type ObjectResponse,
  type StructuredCompletionsRequest,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context';
import type { LanguageModelV2 } from '@openrouter/ai-sdk-provider';
import { generateObject, jsonSchema } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { CompletionsProvider } from '../../providers/CompletionsProviders';
import { convertToModelMessages } from './utils/convertMessages';
import { convertProviderOptions } from './utils/convertProviderOptions';

export async function completionObject(
  ctx: Context,
  provider: CompletionsProvider,
  model: LanguageModelV2,
  request: StructuredCompletionsRequest,
  actions = {
    generateObject,
  },
): Promise<Result<ObjectResponse, AppError>> {
  try {
    const response = await actions.generateObject({
      model,
      messages: convertToModelMessages(request.messages),
      schema: jsonSchema(request.responseFormat.schema),
      schemaName: request.responseFormat.name,
      schemaDescription: request.responseFormat.description,
      providerOptions: convertProviderOptions(provider),
      mode: 'json',
      output: 'object',
      maxRetries: 0,
      abortSignal: ctx.signal,
    });
    return ok(response);
  } catch (error) {
    return err(
      badRequest('Failed to generate structured completion', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  }
}
