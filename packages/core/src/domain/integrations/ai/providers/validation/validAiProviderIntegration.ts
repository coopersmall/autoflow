import {
  type AiProviderIntegration,
  type AnthropicProviderConfig,
  aiProviderIntegrationSchema,
  anthropicProviderSchema,
  type GoogleProviderConfig,
  type GroqProviderConfig,
  googleProviderSchema,
  groqProviderSchema,
  type OpenAIProviderConfig,
  type OpenRouterProviderConfig,
  openAiProviderSchema,
  openRouterProviderSchema,
} from '@core/domain/integrations/ai/providers/AiProviderIntegration';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validAiProviderIntegration(
  input: unknown,
): Result<AiProviderIntegration, ValidationError> {
  return validate(aiProviderIntegrationSchema, input);
}

export function validOpenAIProviderConfig(
  input: unknown,
): Result<OpenAIProviderConfig, ValidationError> {
  return validate(openAiProviderSchema, input);
}

export function validAnthropicProviderConfig(
  input: unknown,
): Result<AnthropicProviderConfig, ValidationError> {
  return validate(anthropicProviderSchema, input);
}

export function validGoogleProviderConfig(
  input: unknown,
): Result<GoogleProviderConfig, ValidationError> {
  return validate(googleProviderSchema, input);
}

export function validGroqProviderConfig(
  input: unknown,
): Result<GroqProviderConfig, ValidationError> {
  return validate(groqProviderSchema, input);
}

export function validOpenRouterProviderConfig(
  input: unknown,
): Result<OpenRouterProviderConfig, ValidationError> {
  return validate(openRouterProviderSchema, input);
}
