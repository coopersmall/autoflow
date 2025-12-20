// Gateway
export type { IEmbeddingsGateway } from './domain/EmbeddingsGateway.ts';
export { createEmbeddingsService } from './EmbeddingsService.ts';

// Provider types
export type {
  EmbeddingsProvider,
  GoogleEmbeddingsProvider,
  OpenAIEmbeddingsProvider,
} from './providers/EmbeddingsProviders.ts';
export { embeddingsProviderSchema } from './providers/EmbeddingsProviders.ts';
export type { GoogleEmbeddingsProviderOptions } from './providers/google/GoogleEmbeddingsProviderOptions.ts';
export { googleEmbeddingsProviderOptionsSchema } from './providers/google/GoogleEmbeddingsProviderOptions.ts';

// Provider options
export type { OpenAIEmbeddingsProviderOptions } from './providers/openai/OpenAIEmbeddingsProviderOptions.ts';
export { openAIEmbeddingsProviderOptionsSchema } from './providers/openai/OpenAIEmbeddingsProviderOptions.ts';
