import type {
  AppError,
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context.ts';
import type { Result } from 'neverthrow';
import type { IEmbeddingsGateway } from '../domain/EmbeddingsGateway.ts';
import type { EmbeddingsProvider } from '../providers/EmbeddingsProviders.ts';
import { createEmbeddingsModel } from './actions/createEmbeddingsModel.ts';
import { embed } from './actions/embed.ts';
import { embedMany } from './actions/embedMany.ts';

export function createAISDKEmbeddingsGateway(): IEmbeddingsGateway {
  return Object.freeze(new AISDKEmbeddingsGateway());
}

interface AISDKEmbeddingsActions {
  embed: typeof embed;
  embedMany: typeof embedMany;
  createEmbeddingsModel: typeof createEmbeddingsModel;
}

class AISDKEmbeddingsGateway implements IEmbeddingsGateway {
  constructor(
    private readonly actions: AISDKEmbeddingsActions = {
      embed,
      embedMany,
      createEmbeddingsModel,
    },
  ) {}

  async embed(
    ctx: Context,
    provider: EmbeddingsProvider,
    request: EmbeddingRequest,
  ): Promise<Result<EmbeddingResponse, AppError>> {
    const model = this.actions.createEmbeddingsModel(provider);
    return this.actions.embed(ctx, provider, model, request);
  }

  async embedMany(
    ctx: Context,
    provider: EmbeddingsProvider,
    request: EmbeddingsRequest,
  ): Promise<Result<EmbeddingsResponse, AppError>> {
    const model = this.actions.createEmbeddingsModel(provider);
    return this.actions.embedMany(ctx, provider, model, request);
  }
}
