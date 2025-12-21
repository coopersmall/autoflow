import {
  type AppError,
  badRequest,
  type EmbeddingsRequest,
  type EmbeddingsResponse,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context.ts';
import type { EmbeddingModel } from 'ai';
import { embedMany as aiSdkEmbedMany } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { EmbeddingsProvider } from '../../providers/EmbeddingsProviders.ts';
import { convertProviderOptions } from './utils/convertProviderOptions.ts';

export async function embedMany(
  ctx: Context,
  provider: EmbeddingsProvider,
  model: EmbeddingModel<string>,
  request: EmbeddingsRequest,
  actions = {
    embedMany: aiSdkEmbedMany,
  },
): Promise<Result<EmbeddingsResponse, AppError>> {
  try {
    const response = await actions.embedMany({
      model,
      values: request.values,
      providerOptions: convertProviderOptions(provider),
      maxRetries: 0,
      abortSignal: ctx.signal,
    });
    return ok(response);
  } catch (error) {
    return err(
      badRequest('Failed to generate embeddings', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  }
}
