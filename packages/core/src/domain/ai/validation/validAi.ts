import {
  type AIProvider,
  aiProviderSchema,
  type ModelRequest,
  modelRequestSchema,
} from '@core/domain/ai/ai.ts';
import type { AppError } from '@core/errors/AppError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';

export function validAIProvider(input: unknown): Result<AIProvider, AppError> {
  return validate(aiProviderSchema, input);
}

export function validModelRequest(
  input: unknown,
): Result<ModelRequest, AppError> {
  return validate(modelRequestSchema, input);
}
