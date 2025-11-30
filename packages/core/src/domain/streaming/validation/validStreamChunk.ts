import {
  type StreamChunk,
  streamChunkSchema,
} from '@core/domain/streaming/streamChunk.ts';
import type { ValidationError } from '@core/errors/ValidationError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';

export function validStreamChunk(
  input: unknown,
): Result<StreamChunk, ValidationError> {
  return validate(streamChunkSchema, input);
}
