import type {
  AppError,
  EmbeddingRequest,
  EmbeddingResponse,
  EmbeddingsRequest,
  EmbeddingsResponse,
} from '@autoflow/core';
import type { Context } from '@backend/infrastructure/context/Context';
import type { Result } from 'neverthrow';
import type { EmbeddingsProvider } from '../providers/EmbeddingsProviders';

export type IEmbeddingsGateway = Readonly<{
  embed(
    ctx: Context,
    provider: EmbeddingsProvider,
    request: EmbeddingRequest,
  ): Promise<Result<EmbeddingResponse, AppError>>;
  embedMany(
    ctx: Context,
    provider: EmbeddingsProvider,
    request: EmbeddingsRequest,
  ): Promise<Result<EmbeddingsResponse, AppError>>;
}>;
