// Service
export { createCompletionsService } from './CompletionsService.ts';

// Gateway
export type { ICompletionsGateway } from './domain/CompletionsGateway.ts';

// Anthropic builtin tools
export type {
  AnthropicBashToolOptions,
  AnthropicBuiltinTools,
  AnthropicMemoryToolOptions,
  AnthropicTextEditorToolOptions,
} from './providers/anthropic/AnthropicBuiltinTools.ts';
export {
  anthropicBashToolOptionsSchema,
  anthropicBuiltinToolsSchema,
  anthropicMemoryToolOptionsSchema,
  anthropicTextEditorToolOptionsSchema,
} from './providers/anthropic/AnthropicBuiltinTools.ts';

// Anthropic provider options
export type { AnthropicProviderOptions } from './providers/anthropic/AnthropicProviderOptions.ts';
export { anthropicProviderOptionsSchema } from './providers/anthropic/AnthropicProviderOptions.ts';

// Provider types
export type {
  AnthropicCompletionsProvider,
  CompletionsProvider,
  GoogleCompletionsProvider,
  OpenAICompletionsProvider,
} from './providers/CompletionsProviders.ts';
export { completionsProviderSchema } from './providers/CompletionsProviders.ts';

// Google builtin tools
export type {
  GoogleBuiltinTools,
  GoogleCodeExecutionToolOptions,
  GoogleSearchToolOptions,
} from './providers/google/GoogleBuiltinTools.ts';
export {
  googleBuiltinToolsSchema,
  googleCodeExecutionToolOptionsSchema,
  googleSearchToolOptionsSchema,
} from './providers/google/GoogleBuiltinTools.ts';

// Google provider options
export type { GoogleProviderOptions } from './providers/google/GoogleProviderOptions.ts';
export { googleProviderOptionsSchema } from './providers/google/GoogleProviderOptions.ts';

// OpenAI builtin tools
export type {
  OpenAIBuiltinTools,
  OpenAICodeInterpreterToolOptions,
  OpenAIFileSearchToolOptions,
  OpenAIImageGenerationToolOptions,
  OpenAILocalShellToolOptions,
  OpenAIWebSearchToolOptions,
} from './providers/openai/OpenAIBuiltinTools.ts';
export {
  openAIBuiltinToolsSchema,
  openAICodeInterpreterToolOptionsSchema,
  openAIFileSearchToolOptionsSchema,
  openAIImageGenerationToolOptionsSchema,
  openAILocalShellToolOptionsSchema,
  openAIWebSearchToolOptionsSchema,
} from './providers/openai/OpenAIBuiltinTools.ts';

// OpenAI provider options
export type { OpenAIProviderOptions } from './providers/openai/OpenAIProviderOptions.ts';
export { openAIProviderOptionsSchema } from './providers/openai/OpenAIProviderOptions.ts';
