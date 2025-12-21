// Service
export { createCompletionsService } from './CompletionsService';

// Gateway
export type { ICompletionsGateway } from './domain/CompletionsGateway';

// Anthropic builtin tools
export type {
  AnthropicBashToolOptions,
  AnthropicBuiltinTools,
  AnthropicMemoryToolOptions,
  AnthropicTextEditorToolOptions,
} from './providers/anthropic/AnthropicBuiltinTools';
export {
  anthropicBashToolOptionsSchema,
  anthropicBuiltinToolsSchema,
  anthropicMemoryToolOptionsSchema,
  anthropicTextEditorToolOptionsSchema,
} from './providers/anthropic/AnthropicBuiltinTools';

// Anthropic provider options
export type { AnthropicProviderOptions } from './providers/anthropic/AnthropicProviderOptions';
export { anthropicProviderOptionsSchema } from './providers/anthropic/AnthropicProviderOptions';

// Provider types
export type {
  AnthropicCompletionsProvider,
  CompletionsProvider,
  GoogleCompletionsProvider,
  OpenAICompletionsProvider,
} from './providers/CompletionsProviders';
export { completionsProviderSchema } from './providers/CompletionsProviders';

// Google builtin tools
export type {
  GoogleBuiltinTools,
  GoogleCodeExecutionToolOptions,
  GoogleSearchToolOptions,
} from './providers/google/GoogleBuiltinTools';
export {
  googleBuiltinToolsSchema,
  googleCodeExecutionToolOptionsSchema,
  googleSearchToolOptionsSchema,
} from './providers/google/GoogleBuiltinTools';

// Google provider options
export type { GoogleProviderOptions } from './providers/google/GoogleProviderOptions';
export { googleProviderOptionsSchema } from './providers/google/GoogleProviderOptions';

// OpenAI builtin tools
export type {
  OpenAIBuiltinTools,
  OpenAICodeInterpreterToolOptions,
  OpenAIFileSearchToolOptions,
  OpenAIImageGenerationToolOptions,
  OpenAILocalShellToolOptions,
  OpenAIWebSearchToolOptions,
} from './providers/openai/OpenAIBuiltinTools';
export {
  openAIBuiltinToolsSchema,
  openAICodeInterpreterToolOptionsSchema,
  openAIFileSearchToolOptionsSchema,
  openAIImageGenerationToolOptionsSchema,
  openAILocalShellToolOptionsSchema,
  openAIWebSearchToolOptionsSchema,
} from './providers/openai/OpenAIBuiltinTools';

// OpenAI provider options
export type { OpenAIProviderOptions } from './providers/openai/OpenAIProviderOptions';
export { openAIProviderOptionsSchema } from './providers/openai/OpenAIProviderOptions';
