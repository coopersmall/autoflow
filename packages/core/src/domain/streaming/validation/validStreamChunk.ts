import {
  type StreamChunk,
  streamChunkSchema,
} from '@core/domain/streaming/streamChunk.ts';
import type { AppError } from '@core/errors/AppError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';

export function validStreamChunk(
  input: unknown,
): Result<StreamChunk, AppError> {
  return validate(streamChunkSchema, input);
}
