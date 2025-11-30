import {
  type AIProvider,
  aiProviderSchema,
  type ModelRequest,
  modelRequestSchema,
} from '@core/domain/ai/ai.ts';
import type { ValidationError } from '@core/errors/ValidationError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';

export function validAIProvider(
  input: unknown,
): Result<AIProvider, ValidationError> {
  return validate(aiProviderSchema, input);
}

export function validModelRequest(
  input: unknown,
): Result<ModelRequest, ValidationError> {
  return validate(modelRequestSchema, input);
}
