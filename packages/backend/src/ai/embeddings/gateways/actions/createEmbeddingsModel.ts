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
): EmbeddingModel<string> {
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
): EmbeddingModel<string> {
  const {
    model,
    settings: { apiKey },
  } = config;
  return createOpenAI({ apiKey }).textEmbeddingModel(model);
}

function createGoogleEmbeddingsModel(
  config: GoogleEmbeddingsProvider,
): EmbeddingModel<string> {
  const {
    model,
    settings: { apiKey },
  } = config;
  return createGoogleGenerativeAI({ apiKey }).textEmbeddingModel(model);
}
