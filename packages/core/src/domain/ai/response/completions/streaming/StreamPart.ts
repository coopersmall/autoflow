import zod from 'zod';
import {
  filePartSchema,
  reasoningDeltaPartSchema,
  reasoningEndPartSchema,
  reasoningStartPartSchema,
  sourcePartSchema,
  textDeltaPartSchema,
  textEndPartSchema,
  textStartPartSchema,
} from './ContentParts';
import {
  abortPartSchema,
  errorPartSchema,
  finishPartSchema,
  finishStepPartSchema,
  rawPartSchema,
  startPartSchema,
  startStepPartSchema,
} from './LifecycleParts';
import {
  toolCallPartSchema,
  toolErrorPartSchema,
  toolInputDeltaPartSchema,
  toolInputEndPartSchema,
  toolInputStartPartSchema,
  toolOutputDeniedPartSchema,
  toolResultPartSchema,
} from './ToolParts';

export type StreamPart = zod.infer<typeof streamPartSchema>;

// Note: sourcePartSchema is a union, not compatible with discriminated union
// We use zod.union at the end to combine all schemas
export const streamPartSchema = zod.union([
  // Content parts (8)
  textStartPartSchema,
  textEndPartSchema,
  textDeltaPartSchema,
  reasoningStartPartSchema,
  reasoningEndPartSchema,
  reasoningDeltaPartSchema,
  sourcePartSchema, // This is already a union of url and document
  filePartSchema,
  // Tool parts (7)
  toolInputStartPartSchema,
  toolInputEndPartSchema,
  toolInputDeltaPartSchema,
  toolCallPartSchema,
  toolResultPartSchema,
  toolErrorPartSchema,
  toolOutputDeniedPartSchema,
  // Lifecycle parts (7)
  startPartSchema,
  startStepPartSchema,
  finishStepPartSchema,
  finishPartSchema,
  errorPartSchema,
  abortPartSchema,
  rawPartSchema,
]);
