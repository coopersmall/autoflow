import zod from 'zod';
import { fileGeneratedEventDataSchema } from './FileEvents';
import {
  abortEventDataSchema,
  errorEventDataSchema,
  finishEventDataSchema,
  startEventDataSchema,
} from './LifecycleEvents';
import {
  reasoningDeltaEventDataSchema,
  reasoningEndEventDataSchema,
  reasoningStartEventDataSchema,
} from './ReasoningEvents';
import { sourceEventDataSchema } from './SourceEvents';
import {
  stepFinishEventDataSchema,
  stepStartEventDataSchema,
} from './StepEvents';
import {
  textDeltaEventDataSchema,
  textEndEventDataSchema,
  textStartEventDataSchema,
} from './TextEvents';
import {
  toolCallEventDataSchema,
  toolErrorEventDataSchema,
  toolInputDeltaEventDataSchema,
  toolInputEndEventDataSchema,
  toolInputStartEventDataSchema,
  toolResultEventDataSchema,
} from './ToolEvents';

// === ITEM EVENT DATA UNION ===

export const itemEventDataSchema = zod.discriminatedUnion('type', [
  // Text events
  textStartEventDataSchema,
  textEndEventDataSchema,
  textDeltaEventDataSchema,
  // Reasoning events
  reasoningStartEventDataSchema,
  reasoningEndEventDataSchema,
  reasoningDeltaEventDataSchema,
  // Source events
  sourceEventDataSchema,
  // File events
  fileGeneratedEventDataSchema,
  // Tool input streaming events
  toolInputStartEventDataSchema,
  toolInputEndEventDataSchema,
  toolInputDeltaEventDataSchema,
  // Tool call events
  toolCallEventDataSchema,
  toolResultEventDataSchema,
  toolErrorEventDataSchema,
  // Lifecycle events
  startEventDataSchema,
  finishEventDataSchema,
  errorEventDataSchema,
  abortEventDataSchema,
  // Step lifecycle events
  stepStartEventDataSchema,
  stepFinishEventDataSchema,
]);

export type ItemEventData = zod.infer<typeof itemEventDataSchema>;
