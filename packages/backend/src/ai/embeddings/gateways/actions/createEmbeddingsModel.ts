import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { unreachable } from '@core/unreachable';
import type { EmbeddingModel } from 'ai';
import type {
  EmbeddingsProvider,
  GoogleEmbeddingsProvider,
  OpenAIEmbeddingsProvider,
} from '../../providers/EmbeddingsProviders';

export function createEmbeddingsModel(
  provider: EmbeddingsProvider,
): EmbeddingModel {
  switch (provider.provider) {
    case 'openai':
      return createOpenAIEmbeddingsModel(provider);
    case 'google':
      return createGoogleEmbeddingsModel(provider);
    default:
      unreachable(provider);
  }
}

function createOpenAIEmbeddingsModel(
  config: OpenAIEmbeddingsProvider,
): EmbeddingModel {
  const {
    model,
    settings: { apiKey },
  } = config;
  return createOpenAI({ apiKey }).embeddingModel(model);
}

function createGoogleEmbeddingsModel(
  config: GoogleEmbeddingsProvider,
): EmbeddingModel {
  const {
    model,
    settings: { apiKey },
  } = config;
  return createGoogleGenerativeAI({ apiKey }).embeddingModel(model);
}
