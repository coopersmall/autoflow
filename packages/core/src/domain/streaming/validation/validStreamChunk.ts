import {
  type StreamChunk,
  streamChunkSchema,
} from '@core/domain/streaming/streamChunk';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validStreamChunk(
  input: unknown,
): Result<StreamChunk, AppError> {
  return validate(streamChunkSchema, input);
}
