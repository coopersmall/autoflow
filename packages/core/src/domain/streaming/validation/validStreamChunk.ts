import {
  type StreamChunk,
  streamChunkSchema,
} from '@core/domain/streaming/streamChunk';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validStreamChunk(
  input: unknown,
): Result<StreamChunk, ValidationError> {
  return validate(streamChunkSchema, input);
}
