import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import type { AiProviderIntegration } from '@core/domain/integrations/ai/providers/AiProviderIntegration';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';

type Model = LanguageModel;

export function getModel(
  {
    provider,
    model,
  }: {
    provider: AiProviderIntegration;
    model: string;
  },
  actions = {
    createOpenAI,
    createGoogleGenerativeAI,
    createGroq,
    createAnthropic,
    createOpenRouter,
  },
): Model {
  switch (provider.config.provider) {
    case 'openai':
      return actions.createOpenAI({
        apiKey: provider.config.data.apiKey,
      })(model);
    case 'google':
      return actions.createGoogleGenerativeAI({
        apiKey: provider.config.data.apiKey,
      })(model);
    case 'groq':
      return actions.createGroq({
        apiKey: provider.config.data.apiKey,
      })(model);
    case 'anthropic':
      return actions.createAnthropic({
        apiKey: provider.config.data.apiKey,
      })(model);
    case 'openrouter':
      return actions.createOpenRouter({
        apiKey: provider.config.data.apiKey,
      })(model);
  }
}
