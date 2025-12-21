import type {
  AppError,
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context';
import type { Result } from 'neverthrow';
import type { IEmbeddingsGateway } from './domain/EmbeddingsGateway';
import { createAISDKEmbeddingsGateway } from './gateways/AISDKEmbeddingsGateway';
import type { EmbeddingsProvider } from './providers/EmbeddingsProviders';

export function createEmbeddingsService(): IEmbeddingsGateway {
  return Object.freeze(new EmbeddingsService());
}

interface EmbeddingsServiceActions {
  createGateway: typeof createAISDKEmbeddingsGateway;
}

class EmbeddingsService implements IEmbeddingsGateway {
  private readonly gateway: IEmbeddingsGateway;
  constructor(
    private readonly actions: EmbeddingsServiceActions = {
      createGateway: createAISDKEmbeddingsGateway,
    },
  ) {
    this.gateway = this.actions.createGateway();
  }

  async embed(
    ctx: Context,
    provider: EmbeddingsProvider,
    request: EmbeddingRequest,
  ): Promise<Result<EmbeddingResponse, AppError>> {
    return this.gateway.embed(ctx, provider, request);
  }

  async embedMany(
    ctx: Context,
    provider: EmbeddingsProvider,
    request: EmbeddingsRequest,
  ): Promise<Result<EmbeddingsResponse, AppError>> {
    return this.gateway.embedMany(ctx, provider, request);
  }
}
