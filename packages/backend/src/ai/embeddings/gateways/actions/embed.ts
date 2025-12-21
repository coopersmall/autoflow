import {
  type AppError,
  badRequest,
  type EmbeddingRequest,
  type EmbeddingResponse,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context.ts';
import type { EmbeddingModel } from 'ai';
import { embed as aiSdkEmbed } from 'ai';
import { err, ok, type Result } from 'neverthrow';
import type { EmbeddingsProvider } from '../../providers/EmbeddingsProviders.ts';
import { convertProviderOptions } from './utils/convertProviderOptions.ts';

export async function embed(
  ctx: Context,
  provider: EmbeddingsProvider,
  model: EmbeddingModel<string>,
  request: EmbeddingRequest,
  actions = {
    embed: aiSdkEmbed,
  },
): Promise<Result<EmbeddingResponse, AppError>> {
  try {
    const response = await actions.embed({
      model,
      value: request.value,
      providerOptions: convertProviderOptions(provider),
      maxRetries: 0,
      abortSignal: ctx.signal,
    });
    return ok(response);
  } catch (error) {
    return err(
      badRequest('Failed to generate embedding', {
        correlationId: ctx.correlationId,
        cause: error,
      }),
    );
  }
}
