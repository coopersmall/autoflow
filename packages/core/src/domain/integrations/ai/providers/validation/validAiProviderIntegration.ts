import {
  type AiProviderIntegration,
  type AnthropicProviderConfig,
  aiProviderIntegrationSchema,
  anthropicProviderSchema,
  type GoogleProviderConfig,
  googleProviderSchema,
  type OpenAIProviderConfig,
  type OpenRouterProviderConfig,
  openAiProviderSchema,
  openRouterProviderSchema,
} from '@core/domain/integrations/ai/providers/AiProviderIntegration';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validAiProviderIntegration(
  input: unknown,
): Result<AiProviderIntegration, AppError> {
  return validate(aiProviderIntegrationSchema, input);
}

export function validOpenAIProviderConfig(
  input: unknown,
): Result<OpenAIProviderConfig, AppError> {
  return validate(openAiProviderSchema, input);
}

export function validAnthropicProviderConfig(
  input: unknown,
): Result<AnthropicProviderConfig, AppError> {
  return validate(anthropicProviderSchema, input);
}

export function validGoogleProviderConfig(
  input: unknown,
): Result<GoogleProviderConfig, AppError> {
  return validate(googleProviderSchema, input);
}

export function validOpenRouterProviderConfig(
  input: unknown,
): Result<OpenRouterProviderConfig, AppError> {
  return validate(openRouterProviderSchema, input);
}
