import zod from 'zod';
import {
  filePartSchema,
  reasoningPartFinishSchema,
  reasoningPartSchema,
  sourcePartSchema,
  textPartSchema,
} from './ContentParts';
import {
  abortPartSchema,
  errorPartSchema,
  finishPartSchema,
  finishStepPartSchema,
  startPartSchema,
  startStepPartSchema,
} from './LifecycleParts';
import {
  toolCallDeltaPartSchema,
  toolCallPartSchema,
  toolCallStreamingStartPartSchema,
  toolResultPartSchema,
} from './ToolParts';

export type StreamPart = zod.infer<typeof streamPartSchema>;

export const streamPartSchema = zod.discriminatedUnion('type', [
  // Content parts
  textPartSchema,
  reasoningPartSchema,
  reasoningPartFinishSchema,
  sourcePartSchema,
  filePartSchema,
  // Tool parts
  toolCallStreamingStartPartSchema,
  toolCallDeltaPartSchema,
  toolCallPartSchema,
  toolResultPartSchema,
  // Lifecycle parts
  startPartSchema,
  startStepPartSchema,
  finishStepPartSchema,
  finishPartSchema,
  errorPartSchema,
  abortPartSchema,
]);
