import type {
  AgentEvent,
  AgentId,
  StreamableEventType,
} from '@core/domain/agents';
import type { StreamPart } from '@core/domain/ai';

export interface TransformContext {
  readonly manifestId: AgentId;
  readonly parentManifestId: AgentId | undefined;
  readonly stepNumber: number;
  readonly allowedEventTypes: Set<StreamableEventType>;
}

/**
 * Transforms a StreamPart from the completions gateway into an AgentEvent.
 *
 * Returns undefined if:
 * - The event type is not in the allowed set
 * - The stream part type doesn't map to an agent event
 *
 * Note: Step events (start-step, finish-step) don't include stepIndex,
 * so the caller must provide the current step number in the context.
 */
export function transformStreamPart(
  part: StreamPart,
  context: TransformContext,
): AgentEvent | undefined {
  const { manifestId, parentManifestId, stepNumber, allowedEventTypes } =
    context;
  const timestamp = Date.now();

  switch (part.type) {
    case 'text-delta': {
      if (!allowedEventTypes.has('text-delta')) {
        return undefined;
      }
      return {
        type: 'text-delta',
        manifestId,
        parentManifestId,
        timestamp,
        id: part.id,
        text: part.text,
      };
    }

    case 'tool-call': {
      if (!allowedEventTypes.has('tool-call')) {
        return undefined;
      }
      return {
        type: 'tool-call',
        manifestId,
        parentManifestId,
        timestamp,
        stepNumber,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input,
        invalid: part.invalid,
      };
    }

    case 'tool-result': {
      if (!allowedEventTypes.has('tool-result')) {
        return undefined;
      }
      return {
        type: 'tool-result',
        manifestId,
        parentManifestId,
        timestamp,
        stepNumber,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.input,
        output: part.output,
      };
    }

    case 'start-step': {
      if (!allowedEventTypes.has('step-start')) {
        return undefined;
      }
      // start-step doesn't include stepIndex, use context's stepNumber
      return {
        type: 'step-start',
        manifestId,
        parentManifestId,
        timestamp,
        stepIndex: stepNumber,
      };
    }

    case 'finish-step': {
      if (!allowedEventTypes.has('step-finish')) {
        return undefined;
      }
      // finish-step doesn't include stepIndex or isContinued
      return {
        type: 'step-finish',
        manifestId,
        parentManifestId,
        timestamp,
        stepIndex: stepNumber,
        usage: {
          inputTokens: part.usage?.inputTokens,
          outputTokens: part.usage?.outputTokens,
          totalTokens: part.usage?.totalTokens,
          reasoningTokens: part.usage?.reasoningTokens,
          cachedInputTokens: part.usage?.cachedInputTokens,
        },
        finishReason: part.finishReason,
        isContinued: false, // Will be updated by caller if needed
      };
    }

    // These stream parts don't map to agent events
    case 'text-start':
    case 'text-end':
    case 'reasoning-start':
    case 'reasoning-delta':
    case 'reasoning-end':
    case 'source':
    case 'file':
    case 'tool-input-start':
    case 'tool-input-delta':
    case 'tool-input-end':
    case 'tool-error':
    case 'tool-output-denied':
    case 'tool-approval-request':
    case 'start':
    case 'finish':
    case 'error':
    case 'abort':
    case 'raw':
      return undefined;

    default:
      // Exhaustive check - if we get here, we missed a case
      return undefined;
  }
}

/**
 * Creates a Set of allowed event types from the manifest's streaming config.
 * Defaults to ['tool-call'] if no config is provided.
 */
export function getAllowedEventTypes(
  events: readonly StreamableEventType[] | undefined,
): Set<StreamableEventType> {
  const defaultEvents: StreamableEventType[] = ['tool-call'];
  return new Set(events ?? defaultEvents);
}
