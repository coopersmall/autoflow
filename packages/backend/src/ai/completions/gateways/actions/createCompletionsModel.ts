import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { unreachable } from '@core/unreachable';
import type { LanguageModel } from 'ai';
import type {
  AnthropicCompletionsProvider,
  CompletionsProvider,
  GoogleCompletionsProvider,
  OpenAICompletionsProvider,
} from '../../providers/CompletionsProviders';

export function createCompletionsModel(
  request: CompletionsProvider,
): LanguageModel {
  switch (request.provider) {
    case 'openai':
      return createOpenAIProvider(request);
    case 'google':
      return createGoogleProvider(request);
    case 'anthropic':
      return createAnthropicProvider(request);
    default:
      unreachable(request);
  }
}

function createOpenAIProvider(
  config: OpenAICompletionsProvider,
): LanguageModel {
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
): LanguageModel {
  const {
    model,
    settings: { apiKey },
  } = config;

  return createGoogleGenerativeAI({ apiKey }).chat(model);
}

function createAnthropicProvider(
  config: AnthropicCompletionsProvider,
): LanguageModel {
  const {
    model,
    settings: { apiKey },
  } = config;

  return createAnthropic({ apiKey }).chat(model);
}
