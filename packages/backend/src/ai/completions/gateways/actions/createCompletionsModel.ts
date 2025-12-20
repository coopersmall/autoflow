import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { unreachable } from '@core/unreachable';
import type { LanguageModelV2 } from '@openrouter/ai-sdk-provider';
import type {
  AnthropicCompletionsProvider,
  CompletionsProvider,
  GoogleCompletionsProvider,
  OpenAICompletionsProvider,
} from '../../providers/CompletionsProviders.ts';

export function createCompletionsModel(
  request: CompletionsProvider,
): LanguageModelV2 {
  switch (request.provider) {
    case 'openai':
      return createOpenAIProvider(request);
    case 'google':
      return createGoogleProvider(request);
    case 'anthropic':
      return createAnthropicProvider(request);
    default:
      unreachable(request.provider);
  }
}

function createOpenAIProvider(
  config: OpenAICompletionsProvider,
): LanguageModelV2 {
  const {
    model,
    settings: { requestType, apiKey },
  } = config;

  switch (requestType) {
    case 'responses':
      return createOpenAI({ apiKey }).responses(model);
    case 'chatCompletions':
      return createOpenAI({ apiKey }).chat(model);
    default:
      unreachable(requestType);
  }
}

function createGoogleProvider(
  config: GoogleCompletionsProvider,
): LanguageModelV2 {
  const {
    model,
    settings: { apiKey },
  } = config;

  return createGoogleGenerativeAI({ apiKey }).chat(model);
}

function createAnthropicProvider(
  config: AnthropicCompletionsProvider,
): LanguageModelV2 {
  const {
    model,
    settings: { apiKey },
  } = config;

  return createAnthropic({ apiKey }).chat(model);
}
