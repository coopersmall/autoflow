// Gateway
export type { IEmbeddingsGateway } from './domain/EmbeddingsGateway';
export { createEmbeddingsService } from './EmbeddingsService';

// Provider types
export type {
  EmbeddingsProvider,
  GoogleEmbeddingsProvider,
  OpenAIEmbeddingsProvider,
} from './providers/EmbeddingsProviders';
export { embeddingsProviderSchema } from './providers/EmbeddingsProviders';
export type { GoogleEmbeddingsProviderOptions } from './providers/google/GoogleEmbeddingsProviderOptions';
export { googleEmbeddingsProviderOptionsSchema } from './providers/google/GoogleEmbeddingsProviderOptions';

// Provider options
export type { OpenAIEmbeddingsProviderOptions } from './providers/openai/OpenAIEmbeddingsProviderOptions';
export { openAIEmbeddingsProviderOptionsSchema } from './providers/openai/OpenAIEmbeddingsProviderOptions';
